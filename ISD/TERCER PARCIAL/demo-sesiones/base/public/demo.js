// Creo una función para obtener elementos del HTML utilizando su ID,
// así puedo acceder a ellos más fácilmente sin repetir tanto código.
const $ = (id) => document.getElementById(id);

// Creo una función asíncrona para realizar las peticiones al servidor.
// Recibo el método HTTP, la URL y los datos que necesito enviar.
async function llamar(metodo, url, cuerpo) {
  // Configuro las opciones de la petición, indicando el método que voy a utilizar.
  const opciones = { method: metodo, headers: {} };

  // Verifico si tengo información que enviar al servidor.
  // Si es así, indico que los datos estarán en formato JSON.
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;

  try {
    // Utilizo fetch para comunicarme con el servidor y espero su respuesta.
    respuesta = await fetch(url, opciones);
  } catch (error) {
    // Si ocurre un problema de conexión, capturo el error
    // y regreso un código 0 indicando que no se pudo conectar.
    return { status: 0, datos: { error: `No se pudo conectar con el servidor (${error.message})` } };
  }

  try {
    // Intento convertir la respuesta del servidor a formato JSON
    // para poder trabajar con la información que recibí.
    datos = await respuesta.json();
  } catch {
    // Si la respuesta no contiene un JSON válido, asigno null.
    datos = null;
  }

  // Regreso el código de respuesta HTTP y los datos obtenidos.
  return { status: respuesta.status, datos };
}

// Creo una función para identificar qué tipo de respuesta recibí
// dependiendo del código HTTP que regrese el servidor.
function claseDelCodigo(status) {
  if (status >= 200 && status < 300) return 'codigo ok';
  if (status === 401) return 'codigo e401';
  if (status === 403) return 'codigo e403';
  return 'codigo error';
}

// Utilizo esta función para mostrar en la bitácora las peticiones realizadas,
// incluyendo el método, la URL, el código de respuesta y los datos recibidos.
function anotar(metodo, url, status, datos) {
  // Creo un nuevo elemento de lista para registrar cada petición.
  const li = document.createElement('li');

  // Creo un elemento para mostrar el código HTTP
  // y le asigno una clase dependiendo del resultado.
  const codigo = document.createElement('span');
  codigo.className = claseDelCodigo(status);
  codigo.textContent = status;

  // Creo un elemento para mostrar el método y la dirección de la petición.
  const pedido = document.createElement('strong');
  pedido.textContent = ` ${metodo} ${url}`;

  // Creo un espacio para mostrar los datos de respuesta en formato JSON.
  const json = document.createElement('pre');
  json.textContent = JSON.stringify(datos, null, 2);

  // Agrego todos los elementos a la lista y la coloco al inicio de la bitácora.
  li.append(codigo, pedido, json);
  $('bitacora').prepend(li);
}

// Creo una función asíncrona para consultar el estado actual de la sesión.
async function mostrarEstado() {
  // Realizo una petición GET para obtener la información de la sesión.
  const { status, datos } = await llamar('GET', '/api/sesion');
  const estado = $('estado');

  // Compruebo si el servidor respondió correctamente
  // y si existe un usuario con una sesión activa.
  if (status === 200 && datos && datos.usuario) {
    // Obtengo el nombre y el rol del usuario.
    const { nombre, rol } = datos.usuario;

    // Muestro la información de la sesión y el tiempo que falta para expirar.
    estado.textContent = `Con sesión: ${nombre} (${rol}) · sesión ${datos.sesion} · vence en ${datos.expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    // Si no existe una sesión activa, muestro el mensaje correspondiente.
    // También identifico si el problema es por falta de conexión.
    estado.textContent = status === 0 ? 'Sin conexión con el servidor' : `Sin sesión (el servidor responde ${status})`;
    estado.className = 'estado sin-sesion';
  }

  // Consulto y muestro las cookies disponibles desde JavaScript.
  $('cookie-js').textContent = document.cookie || '(vacío)';
}

// Creo una función para generar celdas de una tabla.
// Recibo el texto que quiero mostrar y lo agrego dentro de un td.
function celda(texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  return td;
}

// Esta función me permite consultar y mostrar las sesiones
// que actualmente están registradas en el servidor.
async function mostrarSesiones() {
  // Realizo una petición GET para consultar el diagnóstico de las sesiones.
  const { status, datos } = await llamar('GET', '/api/diagnostico/sesiones');
  const tabla = $('tabla-sesiones');

  // Limpio la tabla antes de agregar la información actualizada.
  tabla.replaceChildren();

  // Verifico si la petición fue exitosa y si recibí información.
  if (status !== 200 || !datos) {
    // Si ocurre un error, muestro el código de respuesta.
    $('donde').textContent = `No se pudo leer el almacén (código ${status})`;

    // Creo una fila para indicar que no hay datos disponibles.
    const tr = document.createElement('tr');
    const td = celda('(sin datos)');
    td.colSpan = 4;
    tr.append(td);
    tabla.append(tr);
    return;
  }

  // Identifico dónde se están almacenando las sesiones:
  // en la memoria del servidor o en una base de datos MySQL.
  $('donde').textContent =
    datos.almacen === 'memoria'
      ? 'En la MEMORIA del servidor (se pierden al reiniciar)'
      : 'En MySQL, tabla sessions (sobreviven a un reinicio del servidor)';

  // Compruebo si existen sesiones registradas.
  if (!datos.sesiones || datos.sesiones.length === 0) {
    // Si no hay sesiones, agrego una fila indicando que no existen registros.
    const tr = document.createElement('tr');
    const td = celda('(sin sesiones)');
    td.colSpan = 4;
    tr.append(td);
    tabla.append(tr);
    return;
  }

  // Recorro todas las sesiones recibidas para mostrar sus datos en la tabla.
  for (const s of datos.sesiones) {
    const tr = document.createElement('tr');

    // Identifico cuál de las sesiones pertenece al usuario actual.
    if (s.esLaTuya) tr.className = 'tuya';

    // Convierto la fecha de expiración a un formato de hora más fácil de leer.
    const vence = s.expira ? new Date(s.expira).toLocaleTimeString() : '—';

    // Agrego a la fila el identificador de sesión, el usuario,
    // el número de visitas y la hora en la que expira.
    tr.append(
      celda(s.esLaTuya ? `${s.sesion} (la tuya)` : s.sesion),
      celda(s.usuario || '(sin usuario)'),
      celda(String(s.visitas)),
      celda(vence),
    );

    // Agrego la fila completa a la tabla.
    tabla.append(tr);
  }
}

// Creo una función para actualizar toda la información de la página.
// Utilizo Promise.all para ejecutar ambas consultas al mismo tiempo
// y esperar a que las dos terminen.
async function refrescarTodo() {
  await Promise.all([mostrarEstado(), mostrarSesiones()]);
}

// Agrego un evento al formulario de inicio de sesión
// para ejecutar el proceso cuando el usuario lo envíe.
$('form-login').addEventListener('submit', async (evento) => {
  // Evito que el formulario recargue la página automáticamente.
  evento.preventDefault();

  // Obtengo el usuario y la contraseña que se ingresaron en los campos.
  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };

  // Envío los datos al servidor mediante una petición POST para iniciar sesión.
  const { status, datos } = await llamar('POST', '/api/login', cuerpo);

  // Registro en la bitácora el resultado de la petición.
  anotar('POST', '/api/login', status, datos);

  // Actualizo la información para mostrar el estado de la sesión.
  await refrescarTodo();
});

// Agrego un evento al campo de usuario para que,
// cuando cambie su contenido, se complete automáticamente la contraseña.
$('usuario').addEventListener('change', () => {
  $('contrasena').value = `${$('usuario').value}12345`;
});

// Selecciono todos los botones que tienen el atributo data-url
// para asignarles un evento de clic.
document.querySelectorAll('button[data-url]').forEach((boton) => {
  boton.addEventListener('click', async () => {
    // Obtengo el método HTTP y la URL que tiene configurados cada botón.
    const { metodo, url } = boton.dataset;

    // Realizo la petición correspondiente al servidor.
    const { status, datos } = await llamar(metodo, url);

    // Registro el resultado en la bitácora.
    anotar(metodo, url, status, datos);

    // Actualizo la información de las sesiones después de cada petición.
    await refrescarTodo();
  });
});

// Asigno al botón de refrescar la función que actualiza toda la información.
$('btn-refrescar').addEventListener('click', refrescarTodo);

// Asigno al botón de sesiones la función que consulta y muestra
// únicamente la información de las sesiones registradas.
$('btn-sesiones').addEventListener('click', mostrarSesiones);

// Creo la función principal que se ejecuta al iniciar la aplicación.
async function iniciar() {
  // Consulto la configuración del servidor mediante una petición GET.
  const { status, datos } = await llamar('GET', '/api/config');

  // Muestro la configuración recibida en formato JSON.
  // Si ocurre un error, muestro el código de respuesta.
  $('config').textContent = status === 200 ? JSON.stringify(datos, null, 2) : `Error ${status}`;

  // Finalmente, actualizo el estado de la sesión y la tabla de sesiones.
  await refrescarTodo();
}

// Ejecuto la función principal para iniciar el funcionamiento de la aplicación.
iniciar();