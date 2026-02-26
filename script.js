const gameState = {
    level: 1,
    currentTileIndex: -1,
    safeTiles: [],
    persistentFallenTiles: [], // Indices of tiles that have fallen in previous turns
    gameOver: false,
    waitingForPlay: false
};

const ui = {
    body: document.body,
    grid: document.getElementById('grid'),
    levelDisplay: document.getElementById('level-indicator'),
    message: document.getElementById('message'),
    playBtn: document.getElementById('play-btn'),
    resetBtn: document.getElementById('reset-btn'),
    bgFrom: document.getElementById('bg-layer-from'),
    bgTo: document.getElementById('bg-layer-to')
};

const SKY_GRADIENTS = {
    1: 'linear-gradient(to bottom, #87CEEB, #E0F7FA)',
    2: 'linear-gradient(to bottom, #4FC3F7, #81D4FA)',
    3: 'linear-gradient(to bottom, #1A237E, #3949AB)',
    4: 'linear-gradient(to bottom, #0a0a2e, #1A237E)'
};

// Initialize Game
function initGame() {
    gameState.level = 1;
    gameState.persistentFallenTiles = [];
    gameState.gameOver = false;
    // Set both layers to level 1 immediately
    ui.bgFrom.style.background = SKY_GRADIENTS[1];
    ui.bgTo.style.background = SKY_GRADIENTS[1];
    ui.bgFrom.style.opacity = '1';
    ui.bgTo.style.opacity = '0';
    ui.body.className = 'level-1';
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
        case 3: safeCount = 5; break;
        case 4: safeCount = 1; break;
        default: safeCount = 1;
    }

    // Filter out tiles that have ALREADY fallen
    const availableIndices = Array.from({ length: 25 }, (_, i) => i)
        .filter(i => !gameState.persistentFallenTiles.includes(i));

    // Shuffle available
    const shuffled = availableIndices.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, safeCount);
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
    if (gameState.level < 4) {
        setMessage("Safe! Moving to next level...");
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
        setMessage("You Won! Clouds Conquered! 🎉");
        ui.playBtn.classList.add('hidden');
        ui.resetBtn.classList.remove('hidden');
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
    setMessage("Oops! You fell! ☁️💀");
    ui.playBtn.classList.add('hidden');
    ui.resetBtn.classList.remove('hidden');
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
    // Level 4: Stars
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

    // Level 4: Satellites
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
