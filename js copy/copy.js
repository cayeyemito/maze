const canvas = document.getElementById("laberintoCanvas");
const ctx = canvas.getContext("2d");

let filas = 35, columnas = 35;  // Tamaño por defecto
let tamañoCelda = 15;
canvas.width = columnas * tamañoCelda;
canvas.height = filas * tamañoCelda;
let caminoRecorrido = [];
// Variables de sonido
let sonidoMeta = new Audio('mp3/b.mp3');
let musicaFondo = new Audio('mp3/a.mp3');
let colorJugador = 'green';

// Configurar la música de fondo para que se reproduzca en bucle
musicaFondo.loop = true;
let keysPressed = {};

const timerElement = document.getElementById("timer");
const reiniciarBtn = document.getElementById("reiniciarBtn");

let laberinto, jugador, meta, tiempoInicio, tiempoTerminado, intervaloTimer;
let rankings = {
    'Fácil': JSON.parse(localStorage.getItem('ranking_fácil')) || [],
    'Medio': JSON.parse(localStorage.getItem('ranking_medio')) || [],
    'Difícil': JSON.parse(localStorage.getItem('ranking_difícil')) || []
};
let nombreJugador = "";
let dificultad;
let poderes = [];
const tiposPoderes = ['velocidad', 'invisibilidad', 'atravesar_paredes'];

function generarLaberinto() {
    laberinto = Array.from({ length: filas }, () => Array(columnas).fill(1));
    let stack = [];
    let x = 1, y = 1;
    laberinto[y][x] = 0;
    stack.push({ x, y });

    let direcciones = [
        { dx: 0, dy: -2 }, { dx: 2, dy: 0 },
        { dx: 0, dy: 2 }, { dx: -2, dy: 0 }
    ];

    while (stack.length > 0) {
        let actual = stack[stack.length - 1];
        let posiblesMovimientos = direcciones
            .map(d => ({ x: actual.x + d.dx, y: actual.y + d.dy, dx: d.dx, dy: d.dy }))
            .filter(m => m.x > 0 && m.x < columnas - 1 && m.y > 0 && m.y < filas - 1 && laberinto[m.y][m.x] === 1);

        if (posiblesMovimientos.length > 0) {
            let elegido = posiblesMovimientos[Math.floor(Math.random() * posiblesMovimientos.length)];
            laberinto[actual.y + elegido.dy / 2][actual.x + elegido.dx / 2] = 0;
            laberinto[elegido.y][elegido.x] = 0;
            stack.push({ x: elegido.x, y: elegido.y });
        } else {
            stack.pop();
        }
    }

    meta = { x: columnas - 2, y: filas - 2 };
    laberinto[meta.y][meta.x] = 0;
    laberinto[meta.y - 1][meta.x] = 0;
    dibujarLaberinto();
}

function colocarPoderes() {
    let cantidadPoderes = Math.floor((filas * columnas) / 100); // Ajustar la cantidad según el tamaño
    
    while (poderes.length < cantidadPoderes) {
        let x = Math.floor(Math.random() * columnas);
        let y = Math.floor(Math.random() * filas);

        if (laberinto[y][x] === 0 && !(x === jugador.x && y === jugador.y) && !(x === meta.x && y === meta.y)) {
            let tipo = tiposPoderes[Math.floor(Math.random() * tiposPoderes.length)];
            poderes.push({ x, y, tipo });
        }
    }
}

// Dibujar laberinto, jugador y meta
function dibujarLaberinto() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar el laberinto
    for (let y = 0; y < filas; y++) {
        for (let x = 0; x < columnas; x++) {
            ctx.fillStyle = laberinto[y][x] === 1 ? "#000" : "#fff";
            ctx.fillRect(x * tamañoCelda, y * tamañoCelda, tamañoCelda, tamañoCelda);
        }
    }

    // Dibujar la estela
    for (let pos of caminoRecorrido) {
        ctx.fillStyle = "rgba(0, 255, 0, 0.3)"; // Color y transparencia de la estela
        ctx.fillRect(pos.x * tamañoCelda, pos.y * tamañoCelda, tamañoCelda, tamañoCelda);
    }

    // Dibujar los poderes
    for (let poder of poderes) {
        switch (poder.tipo) {
            case 'velocidad':
                ctx.fillStyle = 'yellow';
                break;
            case 'invisibilidad':
                ctx.fillStyle = 'purple';
                break;
            case 'atravesar_paredes':
                ctx.fillStyle = 'cyan';
                break;
        }
        ctx.fillRect(poder.x * tamañoCelda, poder.y * tamañoCelda, tamañoCelda, tamañoCelda);
    }

    if (jugador.poderesActivos.invisibilidad) {
        ctx.globalAlpha = 0.5; // Semi-transparencia
    } else {
        ctx.globalAlpha = 1.0; // Opacidad normal
    }
    ctx.fillStyle = colorJugador;
    ctx.fillRect(jugador.x * tamañoCelda, jugador.y * tamañoCelda, tamañoCelda, tamañoCelda);
    ctx.globalAlpha = 1.0; 
    // Meta (rojo)
    ctx.fillStyle = "red";
    ctx.fillRect(meta.x * tamañoCelda, meta.y * tamañoCelda, tamañoCelda, tamañoCelda);
}

function moverJugador(dx, dy) {
    if (tiempoTerminado) return;

    let pasos = jugador.velocidad;
    for (let paso = 0; paso < pasos; paso++) {
        let nuevaX = jugador.x + dx;
        let nuevaY = jugador.y + dy;

        // Asegurar que las coordenadas sean válidas
        nuevaX = Math.max(0, Math.min(columnas - 1, nuevaX));
        nuevaY = Math.max(0, Math.min(filas - 1, nuevaY));

        if (
            (laberinto[nuevaY][nuevaX] === 0 || jugador.poderesActivos.atravesar_paredes) &&
            nuevaX >= 0 && nuevaX < columnas &&
            nuevaY >= 0 && nuevaY < filas
        ) {
            jugador.x = nuevaX;
            jugador.y = nuevaY;
            caminoRecorrido.push({ x: jugador.x, y: jugador.y });

            // Verificar recolección de poder
            for (let i = 0; i < poderes.length; i++) {
                let poder = poderes[i];
                if (poder.x === jugador.x && poder.y === jugador.y) {
                    activarPoder(poder.tipo);
                    poderes.splice(i, 1); // Eliminar poder del laberinto
                    break;
                }
            }

            // Verificar si el jugador ha llegado a la meta
            if (jugador.x === meta.x && jugador.y === meta.y) {
                terminarJuego();
                return;
            }
        } else {
            // Si no puede moverse más, salir del bucle
            break;
        }
    }
    dibujarLaberinto();
    mostrarPoderesActivos();
}

function terminarJuego() {
    tiempoTerminado = true;
    clearInterval(intervaloTimer);

    musicaFondo.pause();
    musicaFondo.currentTime = 0; // Reiniciar música

    sonidoMeta.play();
    let tiempoFinal = ((performance.now() - tiempoInicio) / 1000).toFixed(2);
    timerElement.textContent = tiempoFinal + " segundos";
    dibujarCaminoRecorrido();
    agregarRanking(nombreJugador, tiempoFinal);
    reiniciarBtn.style.display = "block";

    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
}

function activarPoder(tipo) {
    switch (tipo) {
        case 'velocidad':
            jugador.velocidad = 2;
            jugador.poderesActivos.velocidad = true;
            setTimeout(() => {
                jugador.velocidad = 1;
                jugador.poderesActivos.velocidad = false;
                mostrarPoderesActivos();
            }, 5000); // Poder dura 5 segundos
            break;
        case 'invisibilidad':
            jugador.poderesActivos.invisibilidad = true;
            setTimeout(() => {
                jugador.poderesActivos.invisibilidad = false;
                mostrarPoderesActivos();
            }, 5000);
            break;
        case 'atravesar_paredes':
            jugador.poderesActivos.atravesar_paredes = true;
            setTimeout(() => {
                jugador.poderesActivos.atravesar_paredes = false;
                mostrarPoderesActivos();
            }, 5000);
            break;
    }
}

function dibujarCaminoRecorrido() {
    ctx.beginPath();
    ctx.strokeStyle = 'blue'; // Color de la línea del camino
    ctx.lineWidth = 2;

    for (let i = 0; i < caminoRecorrido.length; i++) {
        let pos = caminoRecorrido[i];
        let xPixel = pos.x * tamañoCelda + tamañoCelda / 2;
        let yPixel = pos.y * tamañoCelda + tamañoCelda / 2;

        if (i === 0) {
            ctx.moveTo(xPixel, yPixel);
        } else {
            ctx.lineTo(xPixel, yPixel);
        }
    }
    ctx.stroke();
}


// Iniciar temporizador en tiempo real
function iniciarTemporizador() {
    tiempoInicio = performance.now();
    intervaloTimer = setInterval(() => {
        if (!tiempoTerminado) {
            let tiempoActual = ((performance.now() - tiempoInicio) / 1000).toFixed(2);
            timerElement.textContent = tiempoActual + " segundos";
        }
    }, 100);
}

function agregarRanking(nombre, tiempo) {
    rankings[dificultad].push({ nombre, tiempo: parseFloat(tiempo) });
    rankings[dificultad].sort((a, b) => a.tiempo - b.tiempo);
    if (rankings[dificultad].length > 5) rankings[dificultad].pop();

    localStorage.setItem('ranking_' + dificultad.toLowerCase(), JSON.stringify(rankings[dificultad])); // Guardar el ranking en localStorage

    // Comprobar si es el mejor tiempo
    if (rankings[dificultad][0].nombre === nombre && rankings[dificultad][0].tiempo === parseFloat(tiempo)) {
        // Mostrar notificación de mejor tiempo
        Swal.fire({
            title: "🎉 ¡Felicidades, " + nombre + "! 🎉",
            text: "¡Has conseguido el mejor tiempo con " + tiempo + " segundos! 🚀",
            icon: "success",
            confirmButtonText: "Ver ranking",
            background: "#1e1e2e",
            color: "#FFD700",
            confirmButtonColor: "#ff416c",
            showClass: {
                popup: "animate__animated animate__bounceIn"
            },
            hideClass: {
                popup: "animate__animated animate__bounceOut"
            }
        }).then(() => {
            mostrarRanking(dificultad);
        });
    } else {
        // Mostrar ranking directamente
        mostrarRanking(dificultad);
    }
}


function mostrarRanking(seleccionInicial) {
    let seleccion = seleccionInicial || dificultad;

    // Función para mostrar el ranking de la dificultad seleccionada
    function mostrarRankingDificultad() {
        let rankingDificultad = rankings[seleccion];
        let rankingHtml = rankingDificultad.length > 0
            ? rankingDificultad
                .map((r, i) => `${i + 1}. ${r.nombre}: ${r.tiempo} segundos`)
                .join("<br>")
            : 'No hay registros aún para esta dificultad.';

        Swal.fire({
            title: 'Ranking ' + seleccion,
            html: rankingHtml,
            background: '#1e1e2e',
            color: '#fff',
            showCancelButton: true,
            cancelButtonText: 'Cerrar',
            confirmButtonText: 'Cambiar dificultad',
            confirmButtonColor: '#ff416c',
            cancelButtonColor: '#6c757d',
            backdrop: `
                rgba(0,0,123,0.4)
                url("https://i.gifer.com/YCZH.gif")
                left top
                no-repeat
            `,
            showClass: {
                popup: 'animate__animated animate__fadeInDown'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutUp'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                seleccionarDificultadRanking();
            }
        });
    }

    // Función para seleccionar la dificultad del ranking
    function seleccionarDificultadRanking() {
        Swal.fire({
            title: 'Selecciona la dificultad del ranking',
            text: 'Elige la dificultad que deseas ver:',
            background: '#1e1e2e',
            color: '#fff',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Difícil',
            denyButtonText: 'Medio',
            cancelButtonText: 'Fácil',
            confirmButtonColor: '#dc3545',
            denyButtonColor: '#ffc107',
            cancelButtonColor: '#28a745',
            buttonsStyling: true,
            customClass: {
                actions: 'my-actions',
                cancelButton: 'order-1 right-gap',
                confirmButton: 'order-2',
                denyButton: 'order-3 left-gap',
            },
            reverseButtons: true,
            showClass: {
                popup: 'animate__animated animate__fadeIn'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOut'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                seleccion = 'Difícil';
                mostrarRankingDificultad();
            } else if (result.isDenied) {
                seleccion = 'Medio';
                mostrarRankingDificultad();
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                seleccion = 'Fácil';
                mostrarRankingDificultad();
            }
        });
    }

    // Iniciar mostrando el ranking de la dificultad seleccionada
    mostrarRankingDificultad();
}

async function reiniciarJuego() {
    sonidoMeta.pause();
    // Reiniciamos valores para solicitar nuevamente al usuario
    nombreJugador = "";
    dificultad = "";

    await pedirNombreYSeleccionarDificultad();
    establecerDificultad(); // Ajustar tamaño del laberinto según dificultad

    // Reiniciar variables del juego
    tiempoInicio = null;
    tiempoTerminado = false;
    jugador = {
        x: 1,
        y: 1,
        velocidad: 1,
        poderesActivos: {
            velocidad: false,
            invisibilidad: false,
            atravesar_paredes: false
        }
    };    

    poderes = [];
    caminoRecorrido = [{ x: jugador.x, y: jugador.y }];

    generarLaberinto();
    colocarPoderes();
    dibujarLaberinto();
    timerElement.textContent = "0.00 segundos";
    reiniciarBtn.style.display = "none";
    clearInterval(intervaloTimer);

    // Scroll al contenedor principal
    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
    // En reiniciarJuego(), después de dibujar el laberinto
    musicaFondo.play();
}

reiniciarBtn.addEventListener("click", reiniciarJuego);

// Cambiar tamaño del laberinto según la dificultad
function establecerDificultad() {
    console.log(dificultad)
    switch (dificultad) {
        case 'Fácil':
            filas = 15;
            columnas = 15;
            tamañoCelda = 30;
            break;
        case 'Medio':
            filas = 31;
            columnas = 31;
            tamañoCelda = 20;
            break;
        case 'Difícil':
            filas = 45;
            columnas = 45;
            tamañoCelda = 15;
            break;
    }
    canvas.width = columnas * tamañoCelda;
    canvas.height = filas * tamañoCelda;
}

// Evitar que las flechas hagan scroll
document.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!tiempoTerminado) {
            e.preventDefault(); // Solo bloquea el scroll mientras se juega
            if (!tiempoInicio) iniciarTemporizador();
            if (e.key === "ArrowUp") moverJugador(0, -1);
            if (e.key === "ArrowDown") moverJugador(0, 1);
            if (e.key === "ArrowLeft") moverJugador(-1, 0);
            if (e.key === "ArrowRight") moverJugador(1, 0);
        }
    }
});

async function pedirNombreYSeleccionarDificultad() {
    // Primero pedimos el nombre
    const resultNombre = await Swal.fire({
        title: 'Introduce tu nombre',
        input: 'text',
        inputPlaceholder: 'Escribe tu nombre...',
        confirmButtonText: '¡Listo!',
        background: 'rgba(30, 30, 46, 0.9)',
        color: '#fff',
        inputValidator: (value) => {
            if (value.length > 10) {
                return '¡Recuerda que el nombre no puede tener más de 10 caracteres!';
            }
        }
    });

    nombreJugador = resultNombre.value || 'Anónimo'; // Si no se ingresa nombre, se pone "Anónimo"

    // Después de obtener el nombre, pedimos la dificultad
    const resultDificultad = await Swal.fire({
        title: 'Selecciona la dificultad',
        text: 'Elige la dificultad del juego:',
        icon: 'question',
        showCancelButton: true,
        cancelButtonText: 'Fácil',
        showDenyButton: true,
        denyButtonText: 'Medio',
        showConfirmButton: true,
        confirmButtonText: 'Difícil',
        background: 'rgba(30, 30, 46, 0.9)',
        color: '#fff',
    });

    // Determinar la dificultad según el botón presionado
    if (resultDificultad.isConfirmed) {
        dificultad = 'Difícil';
    } else if (resultDificultad.isDenied) {
        dificultad = 'Medio';
    } else {
        dificultad = 'Fácil';
    }

    // Pedir color del jugador utilizando html en lugar de footer
    const resultColor = await Swal.fire({
        title: 'Selecciona el color de tu personaje',
        background: '#1e1e2e',
        color: '#fff',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Verde',
        denyButtonText: 'Azul',
        cancelButtonText: 'Rojo',
        confirmButtonColor: 'green',
        denyButtonColor: 'blue',
        cancelButtonColor: 'red',
        showCloseButton: true,
        html: `
            <button id="color-yellow" style="background-color: yellow; color: black; margin-right: 5px;">Amarillo</button>
            <button id="color-purple" style="background-color: purple; color: white;">Morado</button>
        `,
        didRender: () => {
            document.getElementById('color-yellow').onclick = function () {
                colorJugador = 'yellow';
                Swal.close(); // Cerrar el SweetAlert
            };
            document.getElementById('color-purple').onclick = function () {
                colorJugador = 'purple';
                Swal.close(); // Cerrar el SweetAlert
            };
        }
    });

    // Asignar color del jugador basado en la selección
    if (resultColor.isConfirmed) {
        colorJugador = 'green';
    } else if (resultColor.isDenied) {
        colorJugador = 'blue';
    } else if (resultColor.dismiss === Swal.DismissReason.cancel) {
        colorJugador = 'red';
    }

    console.log("Dificultad seleccionada:", dificultad);
    console.log("Color seleccionado:", colorJugador);
}   

reiniciarJuego();  // Llamar a reiniciarJuego solo una vez, para iniciar el juego
