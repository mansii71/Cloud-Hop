const gameState = {
    level: 1,
    currentTileIndex: -1,
    safeTiles: [],
    persistentFallenTiles: [], // Indices of tiles that have fallen in previous turns
    gameOver: false,
    waitingForPlay: false,
    ticketOutcome: null,
    winAmount: 0
};

const ui = {
    body: document.body,
    grid: document.getElementById('grid'),
    levelDisplay: document.getElementById('level-indicator'),
    message: document.getElementById('message'),
    playBtn: document.getElementById('play-btn'),
    resetBtn: document.getElementById('reset-btn'),
    bgFrom: document.getElementById('bg-layer-from'),
    bgTo: document.getElementById('bg-layer-to'),
    prizeDisplay: null // Will create this dynamically
};

const SKY_GRADIENTS = {
    1: 'linear-gradient(to bottom, #87CEEB, #E0F7FA)',
    2: 'linear-gradient(to bottom, #4FC3F7, #81D4FA)',
    3: 'linear-gradient(to bottom, #1A237E, #3949AB)',
    4: 'linear-gradient(to bottom, #0a0a2e, #1A237E)',
    5: 'linear-gradient(to bottom, #000000, #0a0a2e)' // Level 5 deep space
};

// Generate ticket according to RTP
function generateTicketOutcome() {
    const rand = Math.random();
    // Lose L1 (0x bet): 30%
    if (rand < 0.30) return { outcome: 'lose_level_1', multiplier: 0 };
    // Clear L1/Lose L2 (0x bet): 30%
    if (rand < 0.60) return { outcome: 'lose_level_2', multiplier: 0 };
    // Clear L2/Lose L3 (1x bet): 25%
    if (rand < 0.85) return { outcome: 'lose_level_3', multiplier: 1 };
    // Clear L3/Lose L4 (5x bet): 10%
    if (rand < 0.95) return { outcome: 'lose_level_4', multiplier: 5 };
    // Clear L4/Lose L5 (20x bet): 4%
    if (rand < 0.99) return { outcome: 'lose_level_5', multiplier: 20 };
    // Clear L5 (100x bet): 1%
    return { outcome: 'win', multiplier: 100 };
}

// Initialize Game
function initGame() {
    gameState.level = 1;
    gameState.persistentFallenTiles = [];
    gameState.gameOver = false;

    // E-Instant: Generate ticket at start
    const ticket = generateTicketOutcome();
    gameState.ticketOutcome = ticket.outcome;
    gameState.winAmount = ticket.multiplier;
    console.log("Ticket Outcome:", gameState.ticketOutcome, "Multiplier:", gameState.winAmount);

    // Set both layers to level 1 immediately
    ui.bgFrom.style.background = SKY_GRADIENTS[1];
    ui.bgTo.style.background = SKY_GRADIENTS[1];
    ui.bgFrom.style.opacity = '1';
    ui.bgTo.style.opacity = '0';
    ui.body.className = 'level-1';

    if (ui.prizeDisplay) {
        ui.prizeDisplay.textContent = 'Potential Win: 100x';
    }

    resetLevel();
}

function resetLevel(keepPlayer) {
    if (!keepPlayer) {
        gameState.currentTileIndex = -1;
    }
    gameState.waitingForPlay = true;
    gameState.safeTiles = generateSafeTiles(gameState.level);

    updateUI();
    updateBackground(gameState.level);
    renderGrid();

    ui.playBtn.textContent = "Play";
    ui.playBtn.disabled = keepPlayer ? true : true;
    ui.resetBtn.classList.add('hidden');
    ui.playBtn.classList.remove('hidden');

    if (keepPlayer) {
        setMessage(`Level ${gameState.level}: Pick a new cloud or click yours to stay!`);
    } else {
        setMessage(`Level ${gameState.level}: Pick a safe cloud!`);
    }
}

function updateBackground(level) {
    const newGradient = SKY_GRADIENTS[level] || SKY_GRADIENTS[1];

    // Cross-fade: the currently visible layer becomes "from",
    // set the hidden layer to the new gradient, then swap opacities
    if (ui.bgFrom.style.opacity === '1') {
        ui.bgTo.style.background = newGradient;
        ui.bgFrom.style.opacity = '0';
        ui.bgTo.style.opacity = '1';
    } else {
        ui.bgFrom.style.background = newGradient;
        ui.bgTo.style.opacity = '0';
        ui.bgFrom.style.opacity = '1';
    }

    // Update body class for text color theming
    ui.body.classList.forEach(cls => {
        if (cls.startsWith('level-')) ui.body.classList.remove(cls);
    });
    ui.body.classList.add(`level-${level}`);
}

// Generate Safe Tiles Logic
function generateSafeTiles(level) {
    let safeCount;
    switch (level) {
        case 1: safeCount = 20; break;
        case 2: safeCount = 15; break;
        case 3: safeCount = 10; break;
        case 4: safeCount = 5; break;
        case 5: safeCount = 1; break;
        default: safeCount = 1;
    }

    // Filter out tiles that have ALREADY fallen
    const availableIndices = Array.from({ length: 25 }, (_, i) => i)
        .filter(i => !gameState.persistentFallenTiles.includes(i));

    // Shuffle available
    const shuffled = availableIndices.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, safeCount);
}

// E-Instant: Ensures the visual outcome matches the pre-determined ticket
function enforceTicketOutcome() {
    const outcome = gameState.ticketOutcome;
    const currentLvl = gameState.level;
    const playerTile = gameState.currentTileIndex;

    // Determine if the player should win or lose this specific level
    let shouldSurvive = true;
    if (outcome === `lose_level_${currentLvl}`) {
        shouldSurvive = false;
    }

    // Is the player currently on a safe tile?
    const isCurrentlySafe = gameState.safeTiles.includes(playerTile);

    if (shouldSurvive && !isCurrentlySafe) {
        // Player needs to survive, but they picked a tile that was randomly assigned unsafe.
        // Swap their tile into the safeTiles array.
        const randomIndex = Math.floor(Math.random() * gameState.safeTiles.length);
        gameState.safeTiles.splice(randomIndex, 1);
        gameState.safeTiles.push(playerTile);
    }
    else if (!shouldSurvive && isCurrentlySafe) {
        // Player needs to lose, but they picked a tile that was randomly assigned safe.
        // Remove their tile from safe array and replace with an unsafe one.
        const indexInSafe = gameState.safeTiles.indexOf(playerTile);
        gameState.safeTiles.splice(indexInSafe, 1);

        const availableUnsafe = Array.from({ length: 25 }, (_, i) => i)
            .filter(i => !gameState.persistentFallenTiles.includes(i) && !gameState.safeTiles.includes(i) && i !== playerTile);

        if (availableUnsafe.length > 0) {
            gameState.safeTiles.push(availableUnsafe[0]);
        }
    }
}

function renderGrid() {
    ui.grid.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement('div');
        tile.classList.add('tile');
        tile.dataset.index = i;

        // If tile has fallen, hide it
        if (gameState.persistentFallenTiles.includes(i)) {
            tile.classList.add('fallen');
            // No click listener for fallen tiles
        } else {
            tile.addEventListener('click', () => onTileClick(i));
        }

        // Add character if player is here
        if (i === gameState.currentTileIndex) {
            const char = document.createElement('div');
            char.classList.add('character');
            char.textContent = '🧍';
            tile.appendChild(char);
            tile.classList.add('selected');
        }

        ui.grid.appendChild(tile);
    }
}

function onTileClick(index) {
    if (!gameState.waitingForPlay || gameState.gameOver) return;

    const previousIndex = gameState.currentTileIndex;
    gameState.currentTileIndex = index;

    renderGrid();

    // Trigger hop animation on the character
    const char = document.querySelector('.character');
    if (char) {
        char.classList.add('hopping');
        char.addEventListener('animationend', () => {
            char.classList.remove('hopping');
        }, { once: true });
    }

    ui.playBtn.disabled = false;
    setMessage("Press Play to see if you're safe!");
}

ui.playBtn.addEventListener('click', () => {
    if (gameState.gameOver || gameState.currentTileIndex === -1) return;
    gameState.waitingForPlay = false;

    // E-Instant logic check before tiles fall
    enforceTicketOutcome();

    // Trigger falling tiles
    const isSafe = gameState.safeTiles.includes(gameState.currentTileIndex);

    // Animate falling tiles
    triggerFallingAnimation().then(() => {
        if (isSafe) {
            handleSuccess();
        } else {
            handleGameOver();
        }
    });
});

ui.resetBtn.addEventListener('click', initGame);

function triggerFallingAnimation() {
    return new Promise((resolve) => {
        const tiles = document.querySelectorAll('.tile');

        // Unsafe tiles are those NOT in safeTiles AND NOT already fallen
        // Actually, we just need to identify which NEW tiles fall this round.
        // Any tile not in safe list falls.
        const newFallenIndices = Array.from({ length: 25 }, (_, i) => i)
            .filter(i => !gameState.safeTiles.includes(i) && !gameState.persistentFallenTiles.includes(i));

        // Add to persistent list
        // We wait until animation ends to formally add them to state for next render?
        // Better to add them now but animation handles visual fall.

        let maxDelay = 0;
        newFallenIndices.forEach(index => {
            const tile = tiles[index];
            if (tile) {
                const delay = Math.random() * 500;
                setTimeout(() => {
                    tile.classList.add('falling');
                }, delay);
                if (delay > maxDelay) maxDelay = delay;
            }
        });

        // Update persistent state after animation
        gameState.persistentFallenTiles.push(...newFallenIndices);

        // If player is on an unsafe tile
        if (!gameState.safeTiles.includes(gameState.currentTileIndex)) {
            const playerTile = tiles[gameState.currentTileIndex];
            const char = playerTile ? playerTile.querySelector('.character') : null;
            if (char) {
                setTimeout(() => {
                    char.classList.add('falling');
                }, 200);
            }
        }

        setTimeout(() => {
            resolve();
        }, maxDelay + 1000);
    });
}

function handleSuccess() {
    if (gameState.level < 5) {
        setMessage(`Safe! Moving to next level...`);
        // Add hop celebration before transitioning
        const char = document.querySelector('.character');
        if (char) {
            char.classList.add('hopping');
        }
        setTimeout(() => {
            gameState.level++;
            resetLevel(true); // Keep player on their cloud
        }, 1500);
    } else {
        setMessage(`Jackpot! You Won ${gameState.winAmount}x! 🚀`);
        if (ui.prizeDisplay) {
            ui.prizeDisplay.textContent = `Won: ${gameState.winAmount}x Bet`;
            ui.prizeDisplay.classList.add('winner');
        }
        ui.playBtn.classList.add('hidden');
        ui.resetBtn.classList.remove('hidden');
        ui.resetBtn.textContent = 'Play Again';
        // Celebrate with hop
        const char = document.querySelector('.character');
        if (char) {
            char.classList.add('hopping');
        }
        gameState.gameOver = true;
    }
}

function handleGameOver() {
    gameState.gameOver = true;
    setMessage(`Oops! You fell! Won ${gameState.winAmount}x Bet 💀`);
    if (ui.prizeDisplay) {
        ui.prizeDisplay.textContent = `Won: ${gameState.winAmount}x Bet`;
    }
    ui.playBtn.classList.add('hidden');
    ui.resetBtn.classList.remove('hidden');
    ui.resetBtn.textContent = 'Play Again';
}

function updateUI() {
    ui.levelDisplay.textContent = `Level: ${gameState.level}`;
}

function setMessage(msg) {
    ui.message.textContent = msg;
}

// Start
initGame();

function createBackgroundElements() {
    // Top bar containing prize
    const header = document.querySelector('header');
    if (header) {
        ui.prizeDisplay = document.createElement('div');
        ui.prizeDisplay.id = 'prize-display';
        ui.prizeDisplay.classList.add('prize-badge');
        ui.prizeDisplay.textContent = 'Potential Win: 100x';
        header.appendChild(ui.prizeDisplay);
    }

    // Level 5: Stars
    const starsContainer = document.createElement('div');
    starsContainer.id = 'stars-container';
    ui.body.insertBefore(starsContainer, ui.body.firstChild);

    for (let i = 0; i < 150; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 100}vh`;
        star.style.animationDelay = `${Math.random() * 3}s`;
        const size = Math.random() * 2 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        starsContainer.appendChild(star);
    }

    // Level 5: Satellites
    const satellitesContainer = document.createElement('div');
    satellitesContainer.id = 'satellites-container';
    ui.body.insertBefore(satellitesContainer, ui.body.firstChild);

    for (let i = 0; i < 2; i++) {
        const sat = document.createElement('div');
        sat.classList.add('satellite');
        sat.textContent = '🛰️';
        sat.style.top = `${10 + Math.random() * 30}vh`;
        sat.style.animationDelay = `${Math.random() * 10}s`;
        sat.style.animationDuration = `${20 + Math.random() * 10}s`;
        satellitesContainer.appendChild(sat);
    }
}
createBackgroundElements();
