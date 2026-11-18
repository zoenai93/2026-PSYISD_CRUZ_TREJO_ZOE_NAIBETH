const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');
const crypto = require('crypto');

const NOMBRE_COOKIE = 'connect.sid';

function idCorto(id) {
  return id ? `${String(id).slice(0, 8)}…` : null;
}

function crearApp(config, pool) {
  const app = express();
  const usuarios = crearModeloUsuarios(pool);

  app.use(express.json());

  const almacen =
    config.almacen === 'memoria'
      ? new session.MemoryStore()
      : new MySQLStore({ createDatabaseTable: true, clearExpired: true, checkExpirationInterval: 60 * 1000 }, pool);

  app.use(
    session({
      name: NOMBRE_COOKIE,
      secret: process.env.SESSION_SECRET || 'cambia-este-secreto',
      saveUninitialized: false, 
      rolling: config.rolling, 
      cookie: {
        maxAge: config.maxAgeMs,
        httpOnly: config.httpOnly,
        sameSite: config.sameSite,
        secure: false, 
        path: '/',
      },
    }),
  );

  function venceEn(sesion) {
    if (sesion && sesion.usuario) {
      const desde = config.rolling ? sesion.ultimoUso : sesion.inicio;
      if (typeof desde === 'number') return desde + config.maxAgeMs;
    }
    // Sesión sin usuario (solo visitas): la fecha de la cookie que guardó el almacén.
    const expira = sesion && sesion.cookie && sesion.cookie.expires;
    return expira ? new Date(expira).getTime() : null;
  }

  function vencida(sesion) {
    const limite = venceEn(sesion);
    return limite !== null && Date.now() > limite;
  }

 
  function borrarCookie(res) {
    res.clearCookie(NOMBRE_COOKIE, { path: '/' });
  }

  function requiereSesion(req, res, next) {
    if (!req.session || !req.session.usuario) {
      return res.status(401).json({ error: '401 · No has iniciado sesión (o tu sesión ya venció)' });
    }
    if (vencida(req.session)) {

      return req.session.destroy(() => {
        borrarCookie(res);
        res.status(401).json({ error: '401 · Tu sesión venció: vuelve a iniciar sesión' });
      });
    }
    if (config.rolling) req.session.ultimoUso = Date.now(); 
    return next();
  }


  function requiereRol(rol) {
    return (req, res, next) => {
      if (req.session.usuario.rol !== rol) {
        return res
          .status(403)
          .json({ error: `403 · Eres ${req.session.usuario.usuario}, pero esta ruta es solo para ${rol}` });
      }
      return next();
    };
  }

  
  const asincrona = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);


  const regenerar = (req) => new Promise((ok, mal) => req.session.regenerate((e) => (e ? mal(e) : ok())));
  const guardar = (req) => new Promise((ok, mal) => req.session.save((e) => (e ? mal(e) : ok())));


  app.get('/api/config', (req, res) => {
    res.json(config);
  });

  
  app.post('/api/visita', (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({ visitas: req.session.visitas, sesion: idCorto(req.sessionID) });
  });


  app.post(
    '/api/login',
    asincrona(async (req, res) => {
      const { usuario, contrasena } = req.body || {};
      const encontrado =
        typeof usuario === 'string' && typeof contrasena === 'string'
          ? await usuarios.verificar(usuario, contrasena)
          : null;
      if (!encontrado) {
       
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }

      // ¿Ya traía una sesión con datos (por ejemplo, de /api/visita)?
      const teniaSesion = Object.keys(req.session).some((clave) => clave !== 'cookie');
      const sesionAntes = teniaSesion ? idCorto(req.sessionID) : null;

  
      if (config.regenerarAlEntrar) await regenerar(req);

      const ahora = Date.now();
      req.session.usuario = encontrado; 
      req.session.inicio = ahora;
      req.session.ultimoUso = ahora;
      await guardar(req);

      return res.json({ usuario: encontrado, sesionAntes, sesionDespues: idCorto(req.sessionID) });
    }),
  );

  app.post('/api/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      borrarCookie(res);
      return res.json({ mensaje: 'Sesión cerrada: el servidor la borró' });
    });
  });

  app.get('/api/sesion', requiereSesion, (req, res) => {
    const limite = venceEn(req.session);
    res.json({
      usuario: req.session.usuario,
      sesion: idCorto(req.sessionID),
      expiraEnSegundos: Math.max(0, Math.round((limite - Date.now()) / 1000)),
    });
  });

  app.get('/api/perfil', requiereSesion, (req, res) => {
    req.session.visitas = (req.session.visitas || 0) + 1;
    res.json({
      mensaje: `Hola, ${req.session.usuario.nombre}`,
      rol: req.session.usuario.rol,
      visitas: req.session.visitas,
    });
  });

  app.get('/api/admin/reporte', requiereSesion, requiereRol('admin'), (req, res) => {
    res.json({ reporte: 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18' });
  });

  app.get('/api/diagnostico/sesiones', (req, res, next) => {
    almacen.all((error, todas) => {
      if (error) return next(error);
      const sesiones = Object.entries(todas || {})
        .filter(([, datos]) => datos && !vencida(datos))
        .map(([id, datos]) => {
          const limite = venceEn(datos);
          return {
            sesion: idCorto(id),
            esLaTuya: id === req.sessionID,
            usuario: datos.usuario ? datos.usuario.usuario : null,
            visitas: datos.visitas || 0,
            expira: limite ? new Date(limite).toISOString() : null,
          };
        });
      return res.json({ almacen: config.almacen === 'memoria' ? 'memoria' : 'mysql', sesiones });
    });
  });


  app.use('/api', (req, res) => {
    res.status(404).json({ error: `404 · No existe la ruta ${req.method} ${req.originalUrl}` });
  });


  app.use(express.static(path.join(__dirname, 'public')));


  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: '500 · Error del servidor' });
  });

  return app;
}

module.exports = { crearApp, NOMBRE_COOKIE };
