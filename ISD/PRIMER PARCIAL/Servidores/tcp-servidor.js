const net = require('net');
const PUERTO = process.env.PUERTO || 5000; //Qué se le asigne un puerto disponible de la computadora o el puerto 5000 si no lo encuentra.

const server = net.createServer((socket) => {
    const cliente = `${socket.remoteAddress}:${socket.remotePort}`;

    console.log(`[TCP] Conexión establecida con el cliente: ${cliente}`);

    socket.on(`data`, (datos) => {
        const crudo = datos.toString().trim();
        console.log(`Por TCP estamos enviando datos crudos así crudisimos: ${datos.length} bytes: ${JSON.stringify(crudo)}`);

        const lineas = crudo.split(`\n`).map((l) => l.trim()).filter(Boolean);
        lineas.forEach(Linea => {
            console.log(`[TCP] Mensaje: "${Linea}"`);
            socket.write(`Eco TCP: ${Linea}\n`);
        });
    });

    socket.on(`close`, () => {
        console.log(`[TCP] Conexión cerrada con el cliente: ${cliente}`);
    });

    socket.on(`error`, (error) => {
        console.error(`[TCP] Error en la conexión con el cliente: ${cliente} - ${error.message}`);
    });
});

server.listen(PUERTO, () => {
    console.log(`Servidor inicializado en: ${PUERTO}`);
});