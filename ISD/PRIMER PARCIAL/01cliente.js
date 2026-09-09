//vamos a progrmar un cliente, mediante el cual vamos a probar la arquitectura de cliente-servidor

const API_URL = "https://proyectobackcecyt9.onrender.com";

async function main(){
    //atiende a todos de forma asincrona,, es decir, no se bloquea mientras espera la respuesta del servidor
    console.log("CLIENTE petición get -> a ${API_URL}/api/talleres");
    //nos da el tiempo de ida y vuelta por medio de la peticion mediante RTT
    const duraciones = Date.now() - inicio;
    //un estatus de erros 500 seria una respuesta valida si el servicio de la BD no esta disponible
    const cuerpo = await respuesta.json();
    console.log("Ciclo de peticón -> respuesta");
    console.log("Protocolo HTTPS sobre TCP: ${respuesta.url}");
    console.log("Status de recibido: ${respuesta.status} ${respuesta.statusText}");
    console.log("Tiempo de ida y vuelta (RTT): ${duraciones} ms");
    console.log(JSON.stringify(cuerpo, null, 2));

}

main();