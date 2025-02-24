const LaberintoGame = (() => {
    const config = {
        cellSize: 15,
        soundPaths: { meta: 'mp3/b.mp3', background: 'mp3/a.mp3' },
        powerTypes: ['velocidad', 'invisibilidad', 'atravesar_paredes'],
        difficultySettings: {
            'Fácil': { size: 15, cell: 30 },
            'Medio': { size: 31, cell: 20 },
            'Difícil': { size: 45, cell: 15 }
        },
        storageKeys: {
            'Fácil': 'ranking_facil',
            'Medio': 'ranking_medio',
            'Difícil': 'ranking_dificil' // Asegurar sin acentos
        }
    };

    const elements = {
        canvas: document.getElementById("laberintoCanvas"),
        ctx: document.getElementById("laberintoCanvas").getContext("2d"),
        timer: document.getElementById("timer"),
        restartBtn: document.getElementById("reiniciarBtn")
    };

    class GameState {
        constructor() {
            this.reset();
        }

        reset() {
            this.rows = config.initialSize;
            this.cols = config.initialSize;
            this.maze = [];
            this.player = {
                x: 1,
                y: 1,
                speed: 1,
                activePowers: { velocidad: false, invisibilidad: false, atravesar_paredes: false }
            };
            this.goal = { x: this.cols - 2, y: this.rows - 2 };
            this.powers = [];
            this.enemies = [];
            this.path = [];
            this.difficulty = 'Fácil';
            this.gameMode = 'clásico';
            this.playerColor = 'green';
            this.timer = { start: null, interval: null, finished: false };
            this.rankings = {
                'Fácil': JSON.parse(localStorage.getItem(config.storageKeys['Fácil'])) || [],
                'Medio': JSON.parse(localStorage.getItem(config.storageKeys['Medio'])) || [],
                'Difícil': JSON.parse(localStorage.getItem(config.storageKeys['Difícil'])) || []
            };
            this.audio = {
                background: new Audio(config.soundPaths.background),
                goal: new Audio(config.soundPaths.meta)
            };
            this.audio.background.loop = true;
        }
    }

    class MazeGenerator {
        static generate(rows, cols) {
            const maze = Array.from({ length: rows }, () => Array(cols).fill(1));
            const stack = [{ x: 1, y: 1 }];
            maze[1][1] = 0;

            const directions = [
                { dx: 0, dy: -2 }, { dx: 2, dy: 0 },
                { dx: 0, dy: 2 }, { dx: -2, dy: 0 }
            ];

            while (stack.length > 0) {
                const current = stack[stack.length - 1];
                const validMoves = directions
                    .map(d => ({
                        x: current.x + d.dx,
                        y: current.y + d.dy,
                        dx: d.dx,
                        dy: d.dy
                    }))
                    .filter(m => this.isValidCell(m, rows, cols, maze));

                if (validMoves.length > 0) {
                    const chosen = validMoves[Math.floor(Math.random() * validMoves.length)];
                    maze[current.y + chosen.dy / 2][current.x + chosen.dx / 2] = 0;
                    maze[chosen.y][chosen.x] = 0;
                    stack.push({ x: chosen.x, y: chosen.y });
                } else {
                    stack.pop();
                }
            }
            
            maze[rows-2][cols-2] = 0;
            maze[rows-3][cols-2] = 0;
            return maze;
        }

        static isValidCell(cell, rows, cols, maze) {
            return cell.x > 0 && cell.x < cols - 1 &&
                   cell.y > 0 && cell.y < rows - 1 &&
                   maze[cell.y][cell.x] === 1;
        }
    }

    class GameManager {
        constructor(state) {
            this.state = state;
            this.setupEventListeners();
        }

        setupEventListeners() {
            elements.restartBtn.addEventListener("click", () => this.restartGame());
            document.addEventListener("keydown", (e) => this.handleKeyPress(e));
        }

        async initializeGame() {
            await this.getPlayerSettings();
            this.setDifficulty();
            this.generateNewGame();
            this.startBackgroundMusic();
            elements.restartBtn.style.display = 'none';
        }
    
        handleKeyPress(event) {
            const moves = {
                ArrowUp: [0, -1], ArrowDown: [0, 1],
                ArrowLeft: [-1, 0], ArrowRight: [1, 0]
            };
    
            if (moves[event.key] && !this.state.timer.finished) {
                event.preventDefault();
                if (!this.state.timer.start) this.startTimer();
                this.movePlayer(...moves[event.key]);
            }
        }
    
        startTimer() {
            this.state.timer.start = performance.now();
            this.state.timer.interval = setInterval(() => {
                if (!this.state.timer.finished) {
                    elements.timer.textContent = 
                        `${((performance.now() - this.state.timer.start) / 1000).toFixed(2)} segundos`;
                }
            }, 100);
        }    

        async getPlayerSettings() {
            this.state.player.name = await this.promptName();
            this.state.gameMode = await this.selectGameMode();
            this.state.difficulty = await this.selectDifficulty();
            this.state.playerColor = await this.selectColor();
        }

        async promptName() {
            const { value: name } = await Swal.fire({
                title: 'Introduce tu nombre',
                input: 'text',
                inputPlaceholder: 'Ej: Jugador1',
                inputValidator: (value) => {
                    if (!value) return '¡Debes ingresar un nombre!';
                    if (value.length > 10) return 'Máximo 10 caracteres';
                },
                background: "#1e1e2e",
                color: "#fff"
            });
            return name || 'Anónimo'; // Asegurar nombre válido
        }

        async selectGameMode() {
            const { isDenied } = await Swal.fire({
                title: 'Selecciona el modo de juego',
                text: 'Elige entre Modo Clásico o Modo Reto:',
                icon: 'question',
                showCancelButton: true,
                cancelButtonText: 'Clásico',
                showDenyButton: true,
                denyButtonText: 'Reto',
                showConfirmButton: false,
                background: 'rgba(30, 30, 46, 0.9)',
                color: '#fff',
            });
            return isDenied ? 'reto' : 'clásico';
        }

        setDifficulty() {
            const { size, cell } = config.difficultySettings[this.state.difficulty];
            this.state.rows = this.state.cols = size;
            elements.canvas.width = elements.canvas.height = size * cell;
            config.cellSize = cell;
        }

        generateNewGame() {
            this.state.maze = MazeGenerator.generate(this.state.rows, this.state.cols);
            this.state.goal = { x: this.state.cols - 2, y: this.state.rows - 2 };
            
            if (this.state.gameMode === 'reto') {
                this.generatePowerUps();
                this.generateEnemies();
                this.startEnemyMovement();
            }
            
            this.drawGame();
        }

        async selectDifficulty() {
            const { value: difficulty } = await Swal.fire({
                title: 'Selecciona dificultad',
                input: 'select',
                inputOptions: { 'Fácil': 'Fácil', 'Medio': 'Medio', 'Difícil': 'Difícil' },
                inputValidator: (value) => !value && 'Debes seleccionar una dificultad',
                confirmButtonText: 'Confirmar',
                background: "#1e1e2e",
                color: "#fff"
            });
            return difficulty || 'Fácil';
        }
    
        async selectColor() {
            return new Promise((resolve) => {
                Swal.fire({
                    title: 'Selecciona el color',
                    html: `
                        <div class="color-picker">
                            <button data-color="green" class="color-btn green"></button>
                            <button data-color="blue" class="color-btn blue"></button>
                            <button data-color="red" class="color-btn red"></button>
                            <button data-color="yellow" class="color-btn yellow"></button>
                            <button data-color="purple" class="color-btn purple"></button>
                        </div>
                    `,
                    background: '#1e1e2e',
                    color: '#fff',
                    showConfirmButton: false,
                    didOpen: () => {
                        document.querySelectorAll('.color-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                resolve(btn.dataset.color);
                                Swal.close();
                            });
                        });
                    }
                });
            });
        }
    
        async getPlayerSettings() {
            this.state.player.name = await this.promptName();
            this.state.gameMode = await this.selectGameMode();
            this.state.difficulty = await this.selectDifficulty(); // Aquí se usaba la función faltante
            this.state.playerColor = await this.selectColor();
        }

        generatePowerUps() {
            const powerCount = Math.floor((this.state.rows * this.state.cols) / 100);
            this.state.powers = Array.from({ length: powerCount }, () => 
                this.createRandomPower(this.state.maze));
        }

        createRandomPower(maze) {
            let x, y;
            do {
                x = Math.floor(Math.random() * this.state.cols);
                y = Math.floor(Math.random() * this.state.rows);
            } while (maze[y][x] !== 0 || 
                     (x === this.state.player.x && y === this.state.player.y) ||
                     (x === this.state.goal.x && y === this.state.goal.y));
            
            return {
                x, y,
                type: config.powerTypes[Math.floor(Math.random() * config.powerTypes.length)]
            };
        }

        generateEnemies() {
            const enemyCount = Math.floor((this.state.rows * this.state.cols) / 200);
            this.state.enemies = Array.from({ length: enemyCount }, () => 
                this.createRandomEnemy(this.state.maze));
        }

        createRandomEnemy(maze) {
            let x, y;
            do {
                x = Math.floor(Math.random() * this.state.cols);
                y = Math.floor(Math.random() * this.state.rows);
            } while (maze[y][x] !== 0 || 
                     (x === this.state.player.x && y === this.state.player.y) ||
                     (x === this.state.goal.x && y === this.state.goal.y));
            
            return { x, y };
        }

        startBackgroundMusic() {
            this.state.audio.background.play().catch(console.error);
        }

        startEnemyMovement() {
            setInterval(() => this.moveEnemies(), 500);
        }

        moveEnemies() {
            if (this.state.gameMode !== 'reto') return;

            this.state.enemies.forEach(enemy => {
                const [dx, dy] = [this.state.player.x - enemy.x, this.state.player.y - enemy.y];
                const distance = Math.abs(dx) + Math.abs(dy);

                if (distance <= 5 && !this.state.player.activePowers.invisibilidad) {
                    enemy.x += Math.sign(dx);
                    enemy.y += Math.sign(dy);
                } else {
                    const randomMove = Math.random() < 0.5 ? 
                        { dx: Math.sign(Math.random() - 0.5), dy: 0 } :
                        { dx: 0, dy: Math.sign(Math.random() - 0.5) };
                    
                    enemy.x = Math.max(0, Math.min(this.state.cols - 1, enemy.x + randomMove.dx));
                    enemy.y = Math.max(0, Math.min(this.state.rows - 1, enemy.y + randomMove.dy));
                }

                if (this.checkCollision(enemy)) this.handleCollision();
            });
            
            this.drawGame();
        }

        checkCollision(enemy) {
            return enemy.x === this.state.player.x && 
                   enemy.y === this.state.player.y &&
                   !this.state.player.activePowers.invisibilidad;
        }

        handleCollision() {
            this.endGame(false);
            Swal.fire('¡Has sido atrapado!', 'Inténtalo de nuevo.', 'error')
                .then(() => this.restartGame());
        }

        startTimer() {
            this.state.timer.start = performance.now();
            this.state.timer.interval = setInterval(() => {
                if (!this.state.timer.finished) {
                    elements.timer.textContent = 
                        `${((performance.now() - this.state.timer.start) / 1000).toFixed(2)} segundos`;
                }
            }, 100);
        }

        movePlayer(dx, dy) {
            const steps = this.state.player.speed;
            let newX = this.state.player.x;
            let newY = this.state.player.y;
    
            for (let i = 0; i < steps; i++) {
                const nextX = newX + dx;
                const nextY = newY + dy;
    
                if (this.isValidPosition(nextX, nextY)) {
                    newX = nextX;
                    newY = nextY;
                } else {
                    break;
                }
            }
    
            if (newX !== this.state.player.x || newY !== this.state.player.y) {
                this.state.player.x = newX;
                this.state.player.y = newY;
                this.state.path.push({ x: newX, y: newY });
                this.checkPowerPickup();
                this.checkGoalReached();
            }
            
            this.drawGame();
        }
    
        isValidPosition(x, y) {
            return x >= 0 && x < this.state.cols &&
                   y >= 0 && y < this.state.rows &&
                   (this.state.maze[y][x] === 0 || 
                    this.state.player.activePowers.atravesar_paredes);
        }
    
        checkGoalReached() {
            if (this.state.player.x === this.state.goal.x && 
                this.state.player.y === this.state.goal.y) {
                this.endGame(true);
            }
        }

        updatePlayerPosition(pos) {
            this.state.player.x = pos.x;
            this.state.player.y = pos.y;
            this.state.path.push({ x: pos.x, y: pos.y });
        }

        checkPowerPickup() {
            this.state.powers = this.state.powers.filter(power => {
                if (power.x === this.state.player.x && power.y === this.state.player.y) {
                    this.activatePower(power.type);
                    return false;
                }
                return true;
            });
        }

        activatePower(type) {
            this.state.player.activePowers[type] = true;
            setTimeout(() => {
                this.state.player.activePowers[type] = false;
                if (type === 'velocidad') this.state.player.speed = 1;
            }, 5000);
        }

        reachedGoal() {
            return this.state.player.x === this.state.goal.x && 
                   this.state.player.y === this.state.goal.y;
        }

        endGame(success) {
            clearInterval(this.state.timer.interval);
            this.state.timer.finished = true;
            this.state.audio.background.pause();
            elements.restartBtn.style.display = 'block';

            if (success) {
                this.state.audio.goal.play();
                this.updateRankings();
                this.showSuccessMessage();
            }
        }

        async restartGame() {
            this.state.audio.background.pause();
            this.state.audio.background.currentTime = 0;
            this.state.audio.goal.pause();
            this.state.audio.goal.currentTime = 0;
            
            this.state.reset();
            await this.initializeGame();
        }
    
        updateRankings() {
            const time = ((performance.now() - this.state.timer.start) / 1000).toFixed(2);
            const key = config.storageKeys[this.state.difficulty];
            
            const currentRanking = JSON.parse(localStorage.getItem(key)) || [];
            
            // Validación doble de datos
            if (!this.state.player.name || isNaN(time)) {
                console.error('Datos inválidos para ranking:', { 
                    name: this.state.player.name, 
                    time: time 
                });
                return;
            }

            if (!config.storageKeys[this.state.difficulty]) {
                console.error('Clave de ranking no encontrada para:', this.state.difficulty);
                return;
            }
    
            const newEntry = {
                nombre: this.state.player.name, // Cambiar a nombre para consistencia
                tiempo: parseFloat(time),       // Cambiar a tiempo
                fecha: new Date().toISOString()
            };
            
            currentRanking.push(newEntry);
            currentRanking.sort((a, b) => a.tiempo - b.tiempo);
            
            localStorage.setItem(key, JSON.stringify(currentRanking.slice(0, 5)));
        }
    
        showRankings(difficulty = this.state.difficulty) {
            const key = config.storageKeys[difficulty];
            
            if (!key) {
                Swal.fire('Error', 'Dificultad no encontrada', 'error');
                return;
            }
        
            const rawData = localStorage.getItem(key);
            const ranking = rawData ? JSON.parse(rawData) : [];
            
            const validEntries = ranking.filter(entry => 
                entry?.nombre && !isNaN(entry?.tiempo)
            );
        
            Swal.fire({
                title: `🏆 Ranking ${difficulty} 🏆`,
                html: validEntries.length > 0 
                    ? validEntries.map((entry, i) => `
                        <div class="ranking-item">
                            <span class="position">${i + 1}.</span>
                            <span class="name">${entry.nombre}</span>
                            <span class="time">${entry.tiempo.toFixed(2)}s</span>
                        </div>
                    `).join('') 
                    : '¡Sé el primero!',
                confirmButtonText: "Jugar",
                showCancelButton: true,
                cancelButtonText: "Ver otros rankings",
                background: "#1e1e2e",
                color: "#fff"
            }).then((result) => {
                if (result.isConfirmed) this.restartGame();
                if (result.dismiss === Swal.DismissReason.cancel) this.selectRankingDifficulty();
            });
        }

        async showSuccessMessage() {
            await Swal.fire({
                title: "¡Victoria!",
                text: "Has alcanzado la meta con éxito 🎉",
                icon: "success",
                confirmButtonText: "Ver ranking",
                background: "#1e1e2e",
                color: "#FFD700",
                confirmButtonColor: "#ff416c"
            });
            this.showRankings(this.state.difficulty); // Pasar dificultad actual
        }
    
        async selectRankingDifficulty() {
            const { value: difficulty } = await Swal.fire({
                title: 'Seleccionar ranking',
                input: 'select',
                inputOptions: {
                    'Fácil': 'Ranking Fácil',
                    'Medio': 'Ranking Medio',
                    'Difícil': 'Ranking Difícil'
                },
                inputPlaceholder: 'Selecciona dificultad',
                inputValidator: (value) => !value && 'Debes seleccionar una dificultad',
                background: "#1e1e2e",
                color: "#fff"
            });
        
            if (difficulty) {
                const selectedDiff = difficulty.replace('Ranking ', '');
                this.showRankings(selectedDiff);
            }
        }

        drawGame() {
            elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
            this.drawMaze();
            this.drawPath();
            this.drawEntities();
        }

        drawMaze() {
            for (let y = 0; y < this.state.rows; y++) {
                for (let x = 0; x < this.state.cols; x++) {
                    elements.ctx.fillStyle = this.state.maze[y][x] ? "#000" : "#fff";
                    elements.ctx.fillRect(
                        x * config.cellSize,
                        y * config.cellSize,
                        config.cellSize,
                        config.cellSize
                    );
                }
            }
        }

        drawPath() {
            elements.ctx.strokeStyle = 'blue';
            elements.ctx.beginPath();
            this.state.path.forEach((pos, i) => {
                const [x, y] = [pos.x * config.cellSize + config.cellSize/2, 
                              pos.y * config.cellSize + config.cellSize/2];
                i === 0 ? elements.ctx.moveTo(x, y) : elements.ctx.lineTo(x, y);
            });
            elements.ctx.stroke();
        }

        drawEntities() {
            this.drawPlayer();
            this.drawGoal();
            if (this.state.gameMode === 'reto') {
                this.drawPowerUps();
                this.drawEnemies();
            }
        }

        drawPlayer() {
            elements.ctx.fillStyle = this.state.playerColor;
            elements.ctx.globalAlpha = this.state.player.activePowers.invisibilidad ? 0.5 : 1;
            elements.ctx.fillRect(
                this.state.player.x * config.cellSize,
                this.state.player.y * config.cellSize,
                config.cellSize,
                config.cellSize
            );
            elements.ctx.globalAlpha = 1;
        }

        drawGoal() {
            elements.ctx.fillStyle = "red";
            elements.ctx.fillRect(
                this.state.goal.x * config.cellSize,
                this.state.goal.y * config.cellSize,
                config.cellSize,
                config.cellSize
            );
        }

        drawPowerUps() {
            this.state.powers.forEach(power => {
                elements.ctx.fillStyle = this.getPowerColor(power.type);
                elements.ctx.fillRect(
                    power.x * config.cellSize,
                    power.y * config.cellSize,
                    config.cellSize,
                    config.cellSize
                );
            });
        }

        getPowerColor(type) {
            return {
                velocidad: 'yellow',
                invisibilidad: 'purple',
                atravesar_paredes: 'cyan'
            }[type];
        }

        drawEnemies() {
            elements.ctx.fillStyle = "black";
            this.state.enemies.forEach(enemy => {
                elements.ctx.fillRect(
                    enemy.x * config.cellSize,
                    enemy.y * config.cellSize,
                    config.cellSize,
                    config.cellSize
                );
            });
        }

        async restartGame() {
            this.state.reset();
            await this.initializeGame();
        }
    }

    return { GameState, GameManager };
})();

// Inicialización del juego
const gameState = new LaberintoGame.GameState();
const gameManager = new LaberintoGame.GameManager(gameState);
gameManager.initializeGame();