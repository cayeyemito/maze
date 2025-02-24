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
let modoJuego; // 'clásico' o 'reto'

// Configurar la música de fondo para que se reproduzca en bucle
musicaFondo.loop = true;
let keysPressed = {};

const timerElement = document.getElementById("timer");
const reiniciarBtn = document.getElementById("reiniciarBtn");

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function inicializarEstadisticas(estadisticasCargadas) {
    return {
        laberintosCompletados: estadisticasCargadas.laberintosCompletados || 0,
        poderesRecogidos: estadisticasCargadas.poderesRecogidos || 0,
        poderesRecogidosEnPartida: estadisticasCargadas.poderesRecogidosEnPartida || 0,
        enemigosEvadidos: estadisticasCargadas.enemigosEvadidos || 0,
        laberintosSinSerAtrapado: estadisticasCargadas.laberintosSinSerAtrapado || 0,
        laberintoActual: {
            fueAtrapado: estadisticasCargadas.laberintoActual?.fueAtrapado || false,
            poderesUsados: estadisticasCargadas.laberintoActual?.poderesUsados || 0,
            poderesUsadosTipos: {
                velocidad: estadisticasCargadas.laberintoActual?.poderesUsadosTipos?.velocidad || false,
                invisibilidad: estadisticasCargadas.laberintoActual?.poderesUsadosTipos?.invisibilidad || false,
                atravesar_paredes: estadisticasCargadas.laberintoActual?.poderesUsadosTipos?.atravesar_paredes || false
            },
            evadioEnemigoCerca: estadisticasCargadas.laberintoActual?.evadioEnemigoCerca || false,
            modoJuego: estadisticasCargadas.laberintoActual?.modoJuego || ''
        }
    };
}

let estadisticasCargadas = JSON.parse(localStorage.getItem('estadisticas')) || {};
let estadisticas = inicializarEstadisticas(estadisticasCargadas);

const misiones = [
    {
        id: 1,
        descripcion: "Completa el laberinto en menos de 2 minutos.",
        cumplida: false,
        condicion: (tiempo) => tiempo <= 120 // Tiempo en segundos
    },
    {
        id: 2,
        descripcion: "Completa un laberinto en menos de 1 minuto.",
        cumplida: false,
        condicion: (tiempoFinal) => parseFloat(tiempoFinal) <= 60
    },    
    {
        id: 3,
        descripcion: "Recoge al menos 5 poderes en una partida.",
        cumplida: false,
        condicion: (tiempoFinal, modoJuego) => {
            if (modoJuego !== 'reto') return false;
            return estadisticas.poderesRecogidosEnPartida >= 5;
        }
    },
    {
        id: 4,
        descripcion: "Completa un laberinto en Modo Reto sin usar poderes.",
        cumplida: false,
        condicion: (tiempoFinal, modoJuego) => {
            if (modoJuego !== 'reto') return false;
            return estadisticas.laberintoActual.poderesUsados === 0;
        }
    },
    {
        id: 5,
        descripcion: "Evita ser atrapado por un enemigo estando a un paso de distancia.",
        cumplida: false,
        condicion: () => estadisticas.laberintoActual.evadioEnemigoCerca
    },
    {
        id: 6,
        descripcion: "Recoge al menos un poder de cada tipo en una partida.",
        cumplida: false,
        condicion: (estadisticas) => {
            let poderesUsados = estadisticas.laberintoActual?.poderesUsadosTipos;
            if (!poderesUsados) {
                return false;
            }
            return poderesUsados.velocidad && poderesUsados.invisibilidad && poderesUsados.atravesar_paredes;
        }
    }    
];

const logros = [
    {
        id: 1,
        descripcion: "Primer laberinto completado.",
        obtenido: false,
        condicion: (estadisticas) => estadisticas.laberintosCompletados >= 1
    },
    {
        id: 2,
        descripcion: "Completa 10 laberintos en total.",
        obtenido: false,
        condicion: (estadisticas) => estadisticas.laberintosCompletados >= 10,
        progreso: () => `${estadisticas.laberintosCompletados}/10`
    },  
    {
        id: 3,
        descripcion: "¡Completaste un laberinto en Modo Reto usando invisibilidad sin ser atrapado!",
        obtenido: false,
        condicion: (estadisticas) => {
            return estadisticas.laberintoActual.usóInvisibilidad && !estadisticas.laberintoActual.fueAtrapado
                && estadisticas.laberintoActual.modoJuego === 'reto';
        }
    },
    {
        id: 4,
        descripcion: "Completa 50 laberintos en total.",
        obtenido: false,
        condicion: (estadisticas) => estadisticas.laberintosCompletados >= 50,
        progreso: () => `${estadisticas.laberintosCompletados}/50`
    },
    {
        id: 5,
        descripcion: "Completa todas las misiones disponibles.",
        obtenido: false,
        condicion: () => {
            return misiones.every(mision => progresoMisiones[mision.id]);
        },
        progreso: () => {
            let completadas = misiones.filter(mision => progresoMisiones[mision.id]).length;
            return `${completadas}/${misiones.length}`;
        }
    },
    {
        id: 6,
        descripcion: "Completa 5 laberintos seguidos sin ser atrapado en Modo Reto.",
        obtenido: false,
        condicion: (estadisticas) => estadisticas.laberintosSinSerAtrapado >= 5,
        progreso: () => `${estadisticas.laberintosSinSerAtrapado}/5`
    }             
];

let progresoMisiones = JSON.parse(localStorage.getItem('progresoMisiones')) || {};
let progresoLogros = JSON.parse(localStorage.getItem('progresoLogros')) || {};

let laberinto, jugador, meta, tiempoInicio, tiempoTerminado, intervaloTimer, intervaloEnemigos = null;
let rankings = {
    'clásico': {
        'Fácil': JSON.parse(localStorage.getItem('ranking_clásico_fácil')) || [],
        'Medio': JSON.parse(localStorage.getItem('ranking_clásico_medio')) || [],
        'Difícil': JSON.parse(localStorage.getItem('ranking_clásico_difícil')) || []
    },
    'reto': {
        'Fácil': JSON.parse(localStorage.getItem('ranking_reto_fácil')) || [],
        'Medio': JSON.parse(localStorage.getItem('ranking_reto_medio')) || [],
        'Difícil': JSON.parse(localStorage.getItem('ranking_reto_difícil')) || []
    },
    'contrarreloj': {
        'Fácil': JSON.parse(localStorage.getItem('ranking_contrarreloj_fácil')) || [],
        'Medio': JSON.parse(localStorage.getItem('ranking_contrarreloj_medio')) || [],
        'Difícil': JSON.parse(localStorage.getItem('ranking_contrarreloj_difícil')) || []
    }
};
let nombreJugador = "";
let dificultad;
let poderes = [];
const tiposPoderes = ['velocidad', 'invisibilidad', 'atravesar_paredes'];
let enemigos = [];

function generarEnemigos() {
    enemigos = [];
    let cantidadEnemigos = Math.floor((filas * columnas) / 200); // Ajustar según necesidad
    
    while (enemigos.length < cantidadEnemigos) {
        let x = Math.floor(Math.random() * columnas);
        let y = Math.floor(Math.random() * filas);

        if (laberinto[y][x] === 0 && !(x === jugador.x && y === jugador.y) && !(x === meta.x && y === meta.y)) {
            enemigos.push({ x, y });
        }
    }
}

function verificarMisionesYLogros(tiempoFinal, modoJuego, dificultad) {
    return new Promise(async (resolve) => {
        // Verificar misiones
        for (let mision of misiones) {
            if (!progresoMisiones[mision.id] && mision.condicion(tiempoFinal, modoJuego, dificultad)) {
                progresoMisiones[mision.id] = true;
                await notificarMisionCumplida(mision.descripcion);
            }
        }

        // Verificar logros
        for (let logro of logros) {
            if (!progresoLogros[logro.id] && logro.condicion(estadisticas)) {
                progresoLogros[logro.id] = true;
                await notificarLogroObtenido(logro.descripcion);
            }
        }

        // Guardar progreso
        localStorage.setItem('progresoMisiones', JSON.stringify(progresoMisiones));
        localStorage.setItem('progresoLogros', JSON.stringify(progresoLogros));

        // Resolvemos la promesa después de mostrar todas las notificaciones
        resolve();
    });
}

function notificarMisionCumplida(descripcion) {
    return Swal.fire({
        title: '🎯 ¡Misión cumplida!',
        text: descripcion,
        icon: 'success',
        confirmButtonText: 'Genial',
        background: '#1e1e2e',
        color: '#fff',
        confirmButtonColor: '#ff416c',
        showClass: {
            popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
        }
    });
}

function notificarLogroObtenido(descripcion) {
    return Swal.fire({
        title: '🏆 ¡Nuevo logro!',
        text: descripcion,
        icon: 'success',
        confirmButtonText: 'Continuar',
        background: '#1e1e2e',
        color: '#fff',
        confirmButtonColor: '#FFD700',
        showClass: {
            popup: 'animate__animated animate__zoomIn'
        },
        hideClass: {
            popup: 'animate__animated animate__zoomOut'
        }
    });
}

function mostrarMisionesYLogros() {
    let misionesHtml = misiones.map(mision => {
        let estado = progresoMisiones[mision.id] ? 'cumplida' : '';
        return `<li class="${estado}">${mision.descripcion}</li>`;
    }).join('');

    let logrosHtml = logros.map(logro => {
        let estado = progresoLogros[logro.id] ? 'obtenido' : '';
        let progreso = '';
        if (logro.progreso && !progresoLogros[logro.id]) {
            progreso = ` (${logro.progreso()})`;
        }
        return `<li class="${estado}">${logro.descripcion}${progreso}</li>`;
    }).join('');

    Swal.fire({
        title: '📋 Misiones y Logros',
        html: `
            <h3>Misiones</h3>
            <ul class="lista-misiones">${misionesHtml}</ul>
            <h3>Logros</h3>
            <ul class="lista-logros">${logrosHtml}</ul>
        `,
        background: '#1e1e2e',
        color: '#fff',
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#ff416c',
        customClass: {
            popup: 'ranking-popup',
            htmlContainer: 'ranking-content',
        },
        width: '600px'
    });
}  

function mostrarInformacionModoReto() {
    Swal.fire({
        title: 'Modo Reto: Instrucciones',
        html: `
            <h3>Poderes:</h3>
            <ul>
                <li><span style="color: orange;">🟠</span> - Aumenta la velocidad temporalmente.</li>
                <li><span style="color: purple;">🟣</span> - Te vuelve invisible a los enemigos.</li>
                <li><span style="color: cyan;">🔵</span> - Permite atravesar paredes.</li>
            </ul>
            <h3>Enemigos:</h3>
            <ul>
                <li><span style="color: black;">⚫</span> - Persiguen al jugador y terminan el juego si te atrapan.</li>
            </ul>
        `,
        background: '#1e1e2e',
        color: '#fff',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#ff416c'
    });
}

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

    estadisticas.laberintoActual = {
        fueAtrapado: false,
        usóInvisibilidad: false,
        modoJuego: modoJuego
    };    

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

function dibujarLaberinto() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar el laberinto
    for (let y = 0; y < filas; y++) {
        for (let x = 0; x < columnas; x++) {
            ctx.fillStyle = laberinto[y][x] === 1 ? "#000" : "#fff";
            ctx.fillRect(x * tamañoCelda, y * tamañoCelda, tamañoCelda, tamañoCelda);
        }
    }

    // Aplicar gradiente de color a las celdas recorridas
    for (let pos of caminoRecorrido) {
        let centroX = pos.x * tamañoCelda + tamañoCelda / 2;
        let centroY = pos.y * tamañoCelda + tamañoCelda / 2;

        // Crear un gradiente radial
        let gradiente = ctx.createRadialGradient(
            centroX, centroY, 0,                   // Coordenadas y radio del centro
            centroX, centroY, tamañoCelda / 2      // Coordenadas y radio del borde
        );

        let hue = (performance.now() / 10) % 360; // Valor de tono que cambia con el tiempo
        let colorCentro = `hsla(${hue}, 100%, 50%, 0.8)`; // Color en el centro
        let colorBorde = `hsla(${(hue + 60) % 360}, 100%, 50%, 0)`; // Color en el borde

        gradiente.addColorStop(0, colorCentro);
        gradiente.addColorStop(1, colorBorde);

        // Aplicar el gradiente a la celda
        ctx.fillStyle = gradiente;
        ctx.fillRect(pos.x * tamañoCelda, pos.y * tamañoCelda, tamañoCelda, tamañoCelda);
    }

    // Dibujar los poderes (si estás en modo reto)
    if (modoJuego === 'reto') {
        // Dibujar los poderes como círculos
        for (let poder of poderes) {
            let centerX = poder.x * tamañoCelda + tamañoCelda / 2;
            let centerY = poder.y * tamañoCelda + tamañoCelda / 2;
            let radius = tamañoCelda / 2 - 2; // Restamos 2 para que no toque las paredes de la celda
        
            switch (poder.tipo) {
            case 'velocidad':
                ctx.fillStyle = 'yellow';
                break;
            case 'invisibilidad':
                jugador.poderesActivos.invisibilidad = true;
                estadisticas.laberintoActual.usóInvisibilidad = true;
                setTimeout(() => {
                    jugador.poderesActivos.invisibilidad = false;
                }, 5000);
                break;
            case 'atravesar_paredes':
                ctx.fillStyle = 'cyan';
                break;
            }
        
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();
        }  
    }

    // Dibujar los enemigos (si estás en modo reto)
    if (modoJuego === 'reto') {
        ctx.fillStyle = "black"; // Color de los enemigos
        for (let enemigo of enemigos) {
            ctx.fillRect(enemigo.x * tamañoCelda, enemigo.y * tamañoCelda, tamañoCelda, tamañoCelda);
        }
    }

    // Control de visibilidad del jugador
    if (jugador.poderesActivos.invisibilidad) {
        ctx.globalAlpha = 0.5; // Semi-transparencia
    } else {
        ctx.globalAlpha = 1.0; // Opacidad normal
    }

    // Dibujar al jugador
    ctx.fillStyle = colorJugador;
    ctx.fillRect(jugador.x * tamañoCelda, jugador.y * tamañoCelda, tamañoCelda, tamañoCelda);

    ctx.globalAlpha = 1.0; 

    // Dibujar la meta (rojo)
    ctx.fillStyle = "red";
    ctx.fillRect(meta.x * tamañoCelda, meta.y * tamañoCelda, tamañoCelda, tamañoCelda);
}

function moverJugador(dx, dy) {
    if (tiempoTerminado) return;

    let pasos = jugador.velocidad;
    for (let paso = 0; paso < pasos; paso++) {
        // Calcular paso individual
        let nuevaX = jugador.x + dx;
        let nuevaY = jugador.y + dy;

        // Asegurar que las coordenadas sean válidas
        nuevaX = Math.max(0, Math.min(columnas - 1, nuevaX));
        nuevaY = Math.max(0, Math.min(filas - 1, nuevaY));

        // Verificar si el movimiento es válido
        if (
            (
                laberinto[nuevaY][nuevaX] === 0 ||
                (nuevaX === meta.x && nuevaY === meta.y) || // Permitir moverse a la meta
                (modoJuego === 'reto' && jugador.poderesActivos.atravesar_paredes)
            ) &&
            nuevaX >= 0 && nuevaX < columnas &&
            nuevaY >= 0 && nuevaY < filas
        ) {
            // Actualizar la posición del jugador
            jugador.x = nuevaX;
            jugador.y = nuevaY;
            caminoRecorrido.push({ x: jugador.x, y: jugador.y });

            // Verificar si el jugador ha llegado a la meta en este paso
            if (jugador.x === meta.x && jugador.y === meta.y) {
                // **Dibujar el laberinto para actualizar la posición visualmente**
                dibujarLaberinto();

                // **LLamar a terminarJuego después de actualizar la interfaz**
                terminarJuego();
                return; // Salir de la función para evitar movimientos adicionales
            }

            if (modoJuego === 'reto') {
                // Verificar recolección de poder
                for (let i = 0; i < poderes.length; i++) {
                    let poder = poderes[i];
                    if (poder.x === jugador.x && poder.y === jugador.y) {
                        activarPoder(poder.tipo);
                        poderes.splice(i, 1); // Eliminar poder del laberinto
                        break;
                    }
                }
            }
        } else {
            // No se puede mover al siguiente paso, salir del bucle
            break;
        }
    }
    // Dibujar el laberinto después de todos los pasos
    dibujarLaberinto();
}

function moverEnemigos() {
    if (modoJuego !== 'reto') return;
    for (let enemigo of enemigos) {
        let dx = jugador.x - enemigo.x;
        let dy = jugador.y - enemigo.y;
        let distancia = Math.abs(dx) + Math.abs(dy);

        // Si el jugador es visible y está cerca, el enemigo lo persigue
        if (!jugador.poderesActivos.invisibilidad && distancia <= 5) {
            if (Math.abs(dx) > Math.abs(dy)) {
                enemigo.x += dx > 0 ? 1 : -1;
            } else {
                enemigo.y += dy > 0 ? 1 : -1;
            }
        } else {
            // Movimiento aleatorio
            let direcciones = [
                { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
                { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
            ];
            let dir = direcciones[Math.floor(Math.random() * direcciones.length)];
            let nuevaX = enemigo.x + dir.dx;
            let nuevaY = enemigo.y + dir.dy;
            if (nuevaX >= 0 && nuevaX < columnas && nuevaY >= 0 && nuevaY < filas && laberinto[nuevaY][nuevaX] === 0) {
                enemigo.x = nuevaX;
                enemigo.y = nuevaY;
            }
        }

        // Verificar colisión con el jugador
        if (enemigo.x === jugador.x && enemigo.y === jugador.y && !jugador.poderesActivos.invisibilidad) {
            gameOver();
            return;
        } else if (distancia === 1 && !jugador.poderesActivos.invisibilidad) {
            // **El jugador evadió al enemigo por poco**
            estadisticas.enemigosEvadidos++;
            estadisticas.laberintoActual.evadioEnemigoCerca = true;
            localStorage.setItem('estadisticas', JSON.stringify(estadisticas));
        }
    }
    dibujarLaberinto(); // Actualizar el dibujo después de mover enemigos
}

function gameOver() {
    tiempoTerminado = true;
    clearInterval(intervaloTimer);
    clearInterval(intervaloEnemigos); // Detener movimiento de enemigos

    musicaFondo.pause();
    musicaFondo.currentTime = 0;

    estadisticas.laberintoActual.fueAtrapado = true;
    if (modoJuego === 'reto') {
        estadisticas.laberintosSinSerAtrapado = 0; // Reinicia el contador
    }
    localStorage.setItem('estadisticas', JSON.stringify(estadisticas));

    Swal.fire({
        title: "¡Has sido atrapado!",
        text: "Inténtalo de nuevo.",
        icon: "error",
        confirmButtonText: "Reiniciar",
        background: "#1e1e2e",
        color: "#FFD700",
        confirmButtonColor: "#ff416c",
    }).then(() => {
        reiniciarJuego();
    });
}

function terminarJuego() {
    tiempoTerminado = true;
    clearInterval(intervaloTimer);
    if (intervaloEnemigos !== null) {
        clearInterval(intervaloEnemigos);
        intervaloEnemigos = null;
    }

    musicaFondo.pause();
    musicaFondo.currentTime = 0; // Reiniciar música

    sonidoMeta.play();

    let tiempoFinal;

    if (modoJuego === 'contrarreloj') {
        let tiempoRestante = ((tiempoLimite - (performance.now() - tiempoInicio)) / 1000).toFixed(2);
        tiempoFinal = tiempoRestante > 0 ? tiempoRestante : "0.00";
        timerElement.textContent = tiempoFinal + " segundos restantes";
    } else {
        tiempoFinal = ((performance.now() - tiempoInicio) / 1000).toFixed(2);
        timerElement.textContent = tiempoFinal + " segundos";
    }

    dibujarCaminoRecorrido();

    reiniciarBtn.style.display = "block";

    // Actualizar estadísticas
    // Actualizar estadísticas
    estadisticas.laberintosCompletados++;
    if (modoJuego === 'reto') {
        if (!estadisticas.laberintoActual.fueAtrapado) {
            estadisticas.laberintosSinSerAtrapado = (estadisticas.laberintosSinSerAtrapado || 0) + 1;
        } else {
            estadisticas.laberintosSinSerAtrapado = 0; // Reinicia si fue atrapado
        }
    } else {
        estadisticas.laberintosSinSerAtrapado = 0; // Reinicia si no es Modo Reto
    }
    localStorage.setItem('estadisticas', JSON.stringify(estadisticas));

    verificarMisionesYLogros(tiempoFinal, modoJuego, dificultad).then(() => {
        agregarRanking(nombreJugador, tiempoFinal);
    });

    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
}

function activarPoder(tipo) {
    estadisticas.poderesRecogidos++;
    estadisticas.poderesRecogidosEnPartida++;
    estadisticas.laberintoActual.poderesUsados++;
    
    // Asegurarse de que 'poderesUsadosTipos' está definido
    if (!estadisticas.laberintoActual.poderesUsadosTipos) {
        estadisticas.laberintoActual.poderesUsadosTipos = {
            velocidad: false,
            invisibilidad: false,
            atravesar_paredes: false
        };
    }
    
    estadisticas.laberintoActual.poderesUsadosTipos[tipo] = true;
    localStorage.setItem('estadisticas', JSON.stringify(estadisticas));
    switch (tipo) {
        case 'velocidad':
            jugador.velocidad = 2;
            jugador.poderesActivos.velocidad = true;
            setTimeout(() => {
                jugador.velocidad = 1;
                jugador.poderesActivos.velocidad = false;
            }, 5000); // Poder dura 5 segundos
            break;
        case 'invisibilidad':
            jugador.poderesActivos.invisibilidad = true;
            setTimeout(() => {
                jugador.poderesActivos.invisibilidad = false;
            }, 5000);
            break;
        case 'atravesar_paredes':
            jugador.poderesActivos.atravesar_paredes = true;
            setTimeout(() => {
                jugador.poderesActivos.atravesar_paredes = false;
            }, 5000);
            break;
    }

    // **Actualizar estadísticas**
    estadisticas.poderesRecogidos++;
    estadisticas.poderesRecogidosEnPartida++;
    localStorage.setItem('estadisticas', JSON.stringify(estadisticas));
}

function dibujarCaminoRecorrido() {
    ctx.beginPath();
    ctx.strokeStyle =  "rgba(255, 215, 0, 0.4)"; // Gold
    ; // Color de la línea del camino
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
            let tiempoActual = performance.now();
            let tiempoTranscurrido = tiempoActual - tiempoInicio;
            let tiempoRestante;

            if (modoJuego === 'contrarreloj') {
                tiempoRestante = ((tiempoLimite - tiempoTranscurrido) / 1000).toFixed(2);

                if (tiempoRestante <= 0) {
                    tiempoRestante = "0.00";
                    timerElement.textContent = tiempoRestante + " segundos restantes";
                    tiempoTerminado = true;
                    terminarJuegoContrarreloj();
                    clearInterval(intervaloTimer);
                    return;
                }

                if (tiempoRestante <= 10 && modoJuego === 'contrarreloj') {
                    timerElement.style.color = "red";
                } else {
                    timerElement.style.color = "black";
                }

                timerElement.textContent = tiempoRestante + " segundos restantes";
            } else {
                let tiempoActualizado = (tiempoTranscurrido / 1000).toFixed(2);
                timerElement.textContent = tiempoActualizado + " segundos";
            }
        }
    }, 100);
}

function terminarJuegoContrarreloj() {
    tiempoTerminado = true;
    clearInterval(intervaloTimer);

    musicaFondo.pause();
    musicaFondo.currentTime = 0;

    Swal.fire({
        title: "¡Se acabó el tiempo!",
        text: "No lograste completar el laberinto a tiempo.",
        icon: "error",
        confirmButtonText: "Intentar de nuevo",
        background: "#1e1e2e",
        color: "#FFD700",
        confirmButtonColor: "#ff416c",
    }).then(() => {
        reiniciarJuego();
    });
}

function agregarRanking(nombre, tiempo) {
    // Asegurarnos de que la estructura para el modo y dificultad existe
    if (!rankings[modoJuego]) {
        rankings[modoJuego] = {};
    }
    if (!rankings[modoJuego][dificultad]) {
        rankings[modoJuego][dificultad] = [];
    }

    // En modo Contrarreloj, tiempo representa el tiempo restante
    if (modoJuego === 'contrarreloj') {
        rankings[modoJuego][dificultad].push({ nombre, tiempo: parseFloat(tiempo) });
        // Ordenar de mayor a menor
        rankings[modoJuego][dificultad].sort((a, b) => b.tiempo - a.tiempo);
    } else {
        // En otros modos, tiempo representa el tiempo tomado para completar
        rankings[modoJuego][dificultad].push({ nombre, tiempo: parseFloat(tiempo) });
        // Ordenar de menor a mayor
        rankings[modoJuego][dificultad].sort((a, b) => a.tiempo - b.tiempo);
    }

    if (rankings[modoJuego][dificultad].length > 5) rankings[modoJuego][dificultad].pop();

    // Guardar el ranking actualizado en localStorage
    let claveLocalStorage = `ranking_${modoJuego}_${dificultad}`.toLowerCase();
    localStorage.setItem(claveLocalStorage, JSON.stringify(rankings[modoJuego][dificultad]));

    // Comprobar si es el mejor tiempo en esta categoría
    if (rankings[modoJuego][dificultad][0].nombre === nombre && rankings[modoJuego][dificultad][0].tiempo === parseFloat(tiempo)) {
        // Mostrar notificación de mejor tiempo
        Swal.fire({
            title: `🎉 ¡Felicidades, ${nombre}! 🎉`,
            text: `¡Has conseguido el mejor tiempo con ${tiempo} segundos en ${modoJuego.charAt(0).toUpperCase() + modoJuego.slice(1)} - ${dificultad}! 🚀`,
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
            mostrarRanking(modoJuego, dificultad);
        });
    } else {
        // Mostrar ranking directamente
        mostrarRanking(modoJuego, dificultad);
    }
}

function mostrarRanking(modoSeleccionado, dificultadSeleccionada) {
    let modo = modoSeleccionado || modoJuego;
    let dificultad = dificultadSeleccionada || dificultad;

    function mostrarRankingCategoria() {
        let rankingCategoria = rankings[modo][dificultad] || [];
        let rankingHtml = rankingCategoria.length > 0
            ? rankingCategoria
                .map((r, i) => `${i + 1}. ${r.nombre}: ${r.tiempo} segundos`)
                .join("<br>")
            : 'No hay registros aún para esta categoría.';

        let tituloRanking = `Ranking ${modo.charAt(0).toUpperCase() + modo.slice(1)} - ${dificultad}`;

        Swal.fire({
            title: tituloRanking,
            html: rankingHtml,
            showCancelButton: true,
            cancelButtonText: 'Cerrar',
            confirmButtonText: 'Cambiar categoría',
            confirmButtonColor: '#ff416c',
            cancelButtonColor: '#6c757d',
            background: '#1e1e2e',
            color: '#fff',
            customClass: {
                popup: 'ranking-popup',
                title: 'ranking-title',
                htmlContainer: 'ranking-content',
                confirmButton: 'ranking-confirm-button',
                cancelButton: 'ranking-cancel-button'
            },
            showClass: {
                popup: 'animate__animated animate__zoomIn'
            },
            hideClass: {
                popup: 'animate__animated animate__zoomOut'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                seleccionarCategoriaRanking();
            }
        });
    }

    // Función para seleccionar el modo y dificultad del ranking
    function seleccionarCategoriaRanking() {
        Swal.fire({
            title: 'Selecciona el modo y dificultad del ranking',
            background: '#1e1e2e',
            color: '#fff',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Ver ranking',
            confirmButtonColor: '#ff416c',
            cancelButtonColor: '#6c757d',
            reverseButtons: true,
            showLoaderOnConfirm: true,
            preConfirm: () => {
                const modoSeleccionado = Swal.getPopup().querySelector('#modo-select').value;
                const dificultadSeleccionada = Swal.getPopup().querySelector('#dificultad-select').value;
    
                if (!modoSeleccionado || !dificultadSeleccionada) {
                    Swal.showValidationMessage('Por favor, selecciona el modo y la dificultad.');
                    return false;
                }
                return { modoSeleccionado, dificultadSeleccionada };
            },
            html: `
                <label for="modo-select">Modo de Juego:</label>
                <select id="modo-select" class="swal2-select">
                    <option value="" disabled selected>Selecciona un modo</option>
                    <option value="clásico">Clásico</option>
                    <option value="reto">Reto</option>
                    <option value="contrarreloj">Contrarreloj</option>
                </select>
                <br>
                <label for="dificultad-select">Dificultad:</label>
                <select id="dificultad-select" class="swal2-select">
                    <option value="" disabled selected>Selecciona una dificultad</option>
                    <option value="Fácil">Fácil</option>
                    <option value="Medio">Medio</option>
                    <option value="Difícil">Difícil</option>
                </select>
            `,
            focusConfirm: false,
            customClass: {
                popup: 'ranking-popup',
                title: 'ranking-title',
                htmlContainer: 'ranking-content',
                confirmButton: 'ranking-confirm-button',
                cancelButton: 'ranking-cancel-button'
            },
        }).then((result) => {
            if (result.value) {
                const { modoSeleccionado, dificultadSeleccionada } = result.value;
                modo = modoSeleccionado;
                dificultad = dificultadSeleccionada;
                mostrarRankingCategoria();
            }
        });
    }

    // Iniciar mostrando el ranking de la categoría seleccionada
    mostrarRankingCategoria();
}

async function reiniciarJuego() {
    sonidoMeta.pause();
    sonidoMeta.currentTime = 0;

    musicaFondo.pause();
    musicaFondo.currentTime = 0;

    nombreJugador = "";
    dificultad = "";
    modoJuego = "";

    estadisticas.laberintoActual = {
        fueAtrapado: false,
        poderesUsados: 0,
        poderesUsadosTipos: {
            velocidad: false,
            invisibilidad: false,
            atravesar_paredes: false
        },
        evadioEnemigoCerca: false,
        modoJuego: modoJuego
    };
    estadisticas.poderesRecogidosEnPartida = 0;
    
    // Guardar estadísticas actualizadas
    localStorage.setItem('estadisticas', JSON.stringify(estadisticas));

    await pedirNombreYSeleccionarDificultad();
    if (modoJuego === 'reto') {
        mostrarInformacionModoReto();
    }
    mostrarMisionesYLogros()
    establecerDificultad();

    tiempoInicio = null;
    tiempoTerminado = false;
    tiempoLimite = null; // Añadimos tiempoLimite para el modo Contrarreloj

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
    enemigos = [];
    caminoRecorrido = [{ x: jugador.x, y: jugador.y }];

    generarLaberinto();

    if (modoJuego === 'reto') {
        colocarPoderes();
        generarEnemigos();
        intervaloEnemigos = setInterval(moverEnemigos, 500);
    } else if (modoJuego === 'contrarreloj') {
        // Establecer el tiempo límite según la dificultad
        if (dificultad === 'Fácil') {
            tiempoLimite = 10000;
        } else if (dificultad === 'Medio') {
            tiempoLimite = 60000;
        } else if (dificultad === 'Difícil') {
            tiempoLimite = 80000; // 120 segundos
        }
        // No hay poderes ni enemigos en Contrarreloj
        clearInterval(intervaloEnemigos);
        intervaloEnemigos = null;
    } else {
        // Modo Clásico
        clearInterval(intervaloEnemigos);
        intervaloEnemigos = null;
    }

    dibujarLaberinto();

    setupMobileControls()

    timerElement.textContent = modoJuego === 'contrarreloj' ? (tiempoLimite / 1000) + " segundos restantes" : "0.00 segundos";
    reiniciarBtn.style.display = "none";
    clearInterval(intervaloTimer);

    musicaFondo.play().catch((error) => {
        console.error("Error al reproducir la música de fondo:", error);
    });

    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
}

reiniciarBtn.addEventListener("click", reiniciarJuego);

// Cambiar tamaño del laberinto según la dificultad
function establecerDificultad() {
    const isMobile = window.innerWidth < 768;
    
    switch (dificultad) {
        case 'Fácil':
            filas = isMobile ? 11 : 15;
            columnas = isMobile ? 11 : 15;
            tamañoCelda = isMobile ? 25 : 30;
            break;
        case 'Medio':
            filas = isMobile ? 21 : 31;
            columnas = isMobile ? 21 : 31;
            tamañoCelda = isMobile ? 18 : 20;
            break;
        case 'Difícil':
            filas = isMobile ? 31 : 45;
            columnas = isMobile ? 31 : 45;
            tamañoCelda = isMobile ? 12 : 15;
            break;
    }
    
    canvas.width = columnas * tamañoCelda;
    canvas.height = filas * tamañoCelda;
}

// Evitar que las flechas hagan scroll
document.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!tiempoTerminado) {
            e.preventDefault();
            if (!tiempoInicio) iniciarTemporizador();
            if (e.key === "ArrowUp") moverJugador(0, -1);
            if (e.key === "ArrowDown") moverJugador(0, 1);
            if (e.key === "ArrowLeft") moverJugador(-1, 0);
            if (e.key === "ArrowRight") moverJugador(1, 0);
        }
    }
});

// Añadir soporte para swipe táctil
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) moverJugador(1, 0);
        else moverJugador(-1, 0);
    } else {
        if (deltaY > 0) moverJugador(0, 1);
        else moverJugador(0, -1);
    }
    e.preventDefault();
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

    nombreJugador = resultNombre.value || 'Anónimo';

    // Añadir selección del modo de juego
    const resultModo = await Swal.fire({
        title: 'Selecciona el modo de juego',
        text: 'Elige entre Modo Clásico, Modo Reto o Contrarreloj:',
        icon: 'question',
        showCancelButton: true,
        cancelButtonText: 'Clásico',
        showDenyButton: true,
        denyButtonText: 'Reto',
        confirmButtonText: 'Contrarreloj',
        background: 'rgba(30, 30, 46, 0.9)',
        color: '#fff',
    });

    // Determinar el modo de juego según el botón presionado
    if (resultModo.isConfirmed) {
        modoJuego = 'contrarreloj';
    } else if (resultModo.isDenied) {
        modoJuego = 'reto';
    } else {
        modoJuego = 'clásico';
    }

    // Después de seleccionar el modo de juego, pedimos la dificultad
    const resultDificultad = await Swal.fire({
        title: 'Selecciona la dificultad',
        text: 'Elige la dificultad del juego:',
        icon: 'question',
        showCancelButton: true,
        cancelButtonText: 'Fácil',
        showDenyButton: true,
        denyButtonText: 'Medio',
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
        title: 'Selecciona el color',
        html: `
            <div class="color-picker">
                <button id="green" class="color-btn green"></button>
                <button id="blue" class="color-btn blue"></button>
                <button id="red" class="color-btn red"></button>
                <button id="yellow" class="color-btn yellow"></button>
                <button id="purple" class="color-btn purple"></button>
            </div>
        `,
        background: '#1e1e2e',
        color: '#fff',
        showConfirmButton: false,
        didRender: () => {
            document.getElementById('yellow').onclick = function () {
                colorJugador = 'yellow';
                Swal.close(); // Cerrar el SweetAlert
            };
            document.getElementById('green').onclick = function () {
                colorJugador = 'green';
                Swal.close(); // Cerrar el SweetAlert
            };
            document.getElementById('blue').onclick = function () {
                colorJugador = 'blue';
                Swal.close(); // Cerrar el SweetAlert
            };
            document.getElementById('purple').onclick = function () {
                colorJugador = 'purple';
                Swal.close(); // Cerrar el SweetAlert
            };
            document.getElementById('red').onclick = function () {
                colorJugador = 'red';
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

    console.log("Modo de juego seleccionado:", modoJuego);
    console.log("Dificultad seleccionada:", dificultad);
    console.log("Color seleccionado:", colorJugador);
}

// Función para manejar el input táctil
function setupMobileControls() {
    if (!isMobile) return;

    const controls = {
        up: () => moverJugador(0, -1),
        down: () => moverJugador(0, 1),
        left: () => moverJugador(-1, 0),
        right: () => moverJugador(1, 0)
    };

    Object.keys(controls).forEach(direction => {
        const btn = document.getElementById(direction);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            controls[direction]();
        });
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            controls[direction]();
        });
    });
}

window.addEventListener('resize', () => {
    establecerDificultad();
    generarLaberinto();
});

reiniciarJuego();  // Llamar a reiniciarJuego solo una vez, para iniciar el juego