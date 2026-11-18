
const bcrypt = require('bcryptjs');


const HASH_DE_RELLENO = '$2a$10$wQx6pjyqYBypKdFY85KJ3uAGxkR2.R8yMJnBTp4DJkXscXht8KeIi';

function crearModeloUsuarios(pool) {
  
  async function verificar(usuario, contrasena) {

    const [filas] = await pool.query(
      'SELECT id, usuario, nombre, rol, contrasena_hash FROM usuarios WHERE usuario = ?',
      [usuario],
    );
    const fila = filas[0];
    const coincide = await bcrypt.compare(contrasena, fila ? fila.contrasena_hash : HASH_DE_RELLENO);
    if (!fila || !coincide) return null;
    return { id: fila.id, usuario: fila.usuario, nombre: fila.nombre, rol: fila.rol };
  }

  return { verificar };
}

module.exports = { crearModeloUsuarios };
