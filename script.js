console.log('Script loaded');

const canvas = document.getElementById('gameCanvas');
if (!canvas) console.error('Canvas element not found');
const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for performance
if (!ctx) console.error('Canvas context not available');
console.log('Canvas context:', ctx);
const scoreDisplay = document.getElementById('score');
const gameOverDisplay = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');

// Fixed canvas size
canvas.width = 800;
canvas.height = 600;

console.log('Canvas size:', canvas.width, canvas.height);

// Game settings
const GAME = {
    LANE_WIDTH: canvas.width / 3,
    LANE_NAMES: [
        'Bourbon St.',
        'Canal St.',
        'Royal St.'
    ],
    LANES: [
        canvas.width / 6,      // Bourbon Street (left)
        canvas.width / 2,      // Canal Street (middle)
        5 * canvas.width / 6   // Royal Street (right)
    ],
    PLAYER_SIZE: 60,
    BASE_SPEED: 5,
    MAX_SPEED: 12,
    ACCELERATION: 0.0005,
    JUMP_FORCE: -20,    // Stronger jump
    GRAVITY: 0.8,       // Slower fall
    OBSTACLE_HEIGHT: 40  // Shorter obstacles for easier jumping
};

// Game state
let gameRunning = true;
let score = 0;
let currentSpeed = GAME.BASE_SPEED;
let currentLane = 1;  // Start in middle lane
let playerX = GAME.LANES[currentLane] - GAME.PLAYER_SIZE/2;
let playerY = canvas.height - 120;
let isJumping = false;
let jumpVelocity = 0;
let schneebergActive = false;
let schneebergTimer = 0;
let playerName = '';
let leaderboard = [];

// Load images
const andrewImg = new Image();
andrewImg.src = 'Andrew.png';
andrewImg.onload = () => console.log('Andrew image loaded');
andrewImg.onerror = () => {
    console.error('Failed to load Andrew.png, using fallback');
    andrewImg.complete = true; // Treat as loaded to prevent delays
};

const duckImg = new Image();
duckImg.src = 'duck.png';
duckImg.onload = () => console.log('Duck image loaded');
duckImg.onerror = () => {
    console.error('Failed to load duck.png, using fallback');
    duckImg.complete = true; // Treat as loaded
};

const schneebergImg = new Image();
schneebergImg.src = 'Schneeberg.png';
schneebergImg.onload = () => console.log('Schneeberg image loaded');
schneebergImg.onerror = () => {
    console.error('Failed to load Schneeberg.png, using fallback');
    schneebergImg.complete = true; // Treat as loaded
};

// Objects array
const objects = [];

// Replace the touchstart event listener with these touch events
let touchStartX = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartTime = Date.now();
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndTime = Date.now();
    
    const swipeDistance = touchEndX - touchStartX;
    const swipeTime = touchEndTime - touchStartTime;
    
    // If it's a quick tap (less than 200ms), jump
    if (Math.abs(swipeDistance) < 30 && swipeTime < 200) {
        if (!isJumping) {
            isJumping = true;
            jumpVelocity = GAME.JUMP_FORCE;
        }
        return;
    }
    
    // If it's a swipe (longer movement), change lanes
    if (Math.abs(swipeDistance) > 50) {
        if (swipeDistance > 0 && currentLane < 2) {
            // Swipe right
            currentLane++;
            playerX = GAME.LANES[currentLane] - GAME.PLAYER_SIZE/2;
        } else if (swipeDistance < 0 && currentLane > 0) {
            // Swipe left
            currentLane--;
            playerX = GAME.LANES[currentLane] - GAME.PLAYER_SIZE/2;
        }
    }
});

function spawnObject() {
    const rand = Math.random();
    let type, width, height;
    
    if (rand < 0.7) {  // 70% chance for ducks
        type = 'duck';
        width = height = 60;  // Bigger ducks (was 40)
    } else if (rand < 0.95) {  // 25% chance for leg day
        type = 'legday';
        width = 70;  // Wider leg day (was 50)
        height = GAME.OBSTACLE_HEIGHT;
    } else {  // 5% chance for Schneeberg
        type = 'schneeberg';
        width = height = 70;  // Bigger Schneeberg (was 50)
    }
    
    const lane = Math.floor(Math.random() * 3);
    
    // Check for objects in the same lane to prevent overlap
    const minSpacing = 100;  // Minimum vertical space between objects
    const objectsInLane = objects.filter(obj => {
        const laneX = GAME.LANES[lane] - width/2;
        return Math.abs(obj.x - laneX) < width;  // Objects in same lane
    });
    
    // Find safe spawn position
    let safeY = -50;
    objectsInLane.forEach(obj => {
        if (obj.y < 0) {  // Only check objects above the screen
            safeY = Math.min(safeY, obj.y - minSpacing);
        }
    });
    
    objects.push({
        type: type,
        x: GAME.LANES[lane] - width/2,
        y: safeY,
        width: width,
        height: height
    });
}

function drawGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#4a2c6b';  // Purple sky
    ctx.fillRect(0, 0, canvas.width, canvas.height/2);
    ctx.fillStyle = '#1a5a3d';  // Green ground
    ctx.fillRect(0, canvas.height/2, canvas.width, canvas.height/2);
    
    // Draw lane markers and names
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    
    // Draw each lane name at the top
    GAME.LANE_NAMES.forEach((name, i) => {
        const x = GAME.LANES[i];
        ctx.fillText(name, x, 30);
        
        // Only draw divider lines between lanes
        if (i > 0) {
            ctx.beginPath();
            ctx.moveTo(i * GAME.LANE_WIDTH, 0);
            ctx.lineTo(i * GAME.LANE_WIDTH, canvas.height);
            ctx.stroke();
        }
    });
    
    // Draw player
    if (andrewImg.complete) {
        if (schneebergActive) {
            // Draw timer bar at top of screen
            const timerWidth = (schneebergTimer / 420) * canvas.width; // Scale to canvas width
            ctx.fillStyle = `hsl(200, 100%, ${50 + Math.sin(Date.now() * 0.01) * 20}%)`; // Pulsing blue
            ctx.fillRect(0, 0, timerWidth, 10);
            
            // Flash effect when power-up is ending (last 1 second)
            if (schneebergTimer < 60) {
                ctx.filter = `hue-rotate(180deg) brightness(${1 + Math.sin(Date.now() * 0.05) * 0.2})`; // Flashing effect
            } else {
                ctx.filter = 'hue-rotate(180deg) brightness(1.2)';
            }
            ctx.drawImage(andrewImg, playerX, playerY, GAME.PLAYER_SIZE, GAME.PLAYER_SIZE);
            ctx.filter = 'none';
        } else {
            ctx.drawImage(andrewImg, playerX, playerY, GAME.PLAYER_SIZE, GAME.PLAYER_SIZE);
        }
    }
    
    // Draw objects
    objects.forEach(obj => {
        switch(obj.type) {
            case 'duck':
                if (duckImg.complete) {
                    ctx.drawImage(duckImg, obj.x, obj.y, obj.width, obj.height);
                }
                break;
            case 'legday':
                // Draw a simpler but stylish leg day obstacle
                const x = obj.x;
                const y = obj.y;
                const w = obj.width;
                const h = obj.height;
                
                // Red background
                ctx.fillStyle = '#ff3333';
                ctx.fillRect(x, y, w, h);
                
                // White border
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, w, h);
                
                // Text
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('LEG DAY', x + w/2, y + h/2);
                break;
            case 'schneeberg':
                if (schneebergImg.complete) {
                    ctx.drawImage(schneebergImg, obj.x, obj.y, obj.width, obj.height);
                }
                break;
        }
    });
}

function updateGame() {
    if (!gameRunning) return;
    
    // Update player
    if (isJumping) {
        playerY += jumpVelocity;
        jumpVelocity += GAME.GRAVITY;  // Slower fall
        
        if (playerY >= canvas.height - 120) {
            playerY = canvas.height - 120;
            isJumping = false;
            jumpVelocity = 0;
        }
    }
    
    // Update objects
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        obj.y += currentSpeed; // Remove Schneeberg speed multiplier
        
        // Improved collision detection for jumping over obstacles
        const collision = playerX < obj.x + obj.width &&
                        playerX + GAME.PLAYER_SIZE > obj.x &&
                        playerY < obj.y + obj.height &&
                        playerY + GAME.PLAYER_SIZE > obj.y;

        if (collision) {
            switch(obj.type) {
                case 'duck':
                    score += 10;
                    objects.splice(i, 1);
                    break;
                case 'legday':
                    // Check if player is jumping over the obstacle
                    const playerBottom = playerY + GAME.PLAYER_SIZE;
                    const objectTop = obj.y;
                    
                    // If player's bottom edge is moving upward (jumping) or
                    // high enough above the obstacle, don't collide
                    if (isJumping && (jumpVelocity < 0 || playerBottom < objectTop + 10)) {
                        // Successfully jumping over
                        break;
                    } else {
                        gameOver();
                    }
                    break;
                case 'schneeberg':
                    schneebergActive = true;
                    schneebergTimer = 420;  // 7 seconds (60fps * 7)
                    objects.splice(i, 1);
                    break;
            }
        }
        
        // Remove off-screen objects
        if (obj.y > canvas.height) {
            objects.splice(i, 1);
        }
    }
    
    // Update Schneeberg timer
    if (schneebergActive) {
        schneebergTimer--;
        if (schneebergTimer <= 0) {
            schneebergActive = false;
        }
    }
    
    // Spawn new objects
    if (Math.random() < 0.02) {  // 2% chance each frame
        spawnObject();
    }
    
    // Increase speed over time
    currentSpeed = Math.min(GAME.MAX_SPEED, 
                          GAME.BASE_SPEED + (score * GAME.ACCELERATION));
    
    // Update score display
    scoreDisplay.textContent = `Score: ${score}`;

    // Add player movement speed boost when Schneeberg is active
    if (schneebergActive) {
        // Make lane changes 50% faster
        const laneChangeSpeed = 1.5;
        playerX = playerX + (GAME.LANES[currentLane] - GAME.PLAYER_SIZE/2 - playerX) * laneChangeSpeed;
    }
}

function resetGame() {
    gameRunning = true;
    score = 0;
    currentSpeed = GAME.BASE_SPEED;
    currentLane = 1;
    playerX = GAME.LANES[currentLane] - GAME.PLAYER_SIZE/2;
    playerY = canvas.height - 120;
    isJumping = false;
    jumpVelocity = 0;
    schneebergActive = false;
    schneebergTimer = 0;
    objects.length = 0;
    gameOverDisplay.style.display = 'none';
    loadLeaderboard();
}

function gameLoop() {
    updateGame();
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Load leaderboard from localStorage
function loadLeaderboard() {
    const saved = localStorage.getItem('duckDashLeaderboard');
    if (saved) {
        leaderboard = JSON.parse(saved);
    }
}

// Save score to leaderboard
function saveScore(name, score) {
    leaderboard.push({ name, score });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10); // Keep top 10
    localStorage.setItem('duckDashLeaderboard', JSON.stringify(leaderboard));
}

// Update the leaderboard display
function updateLeaderboardDisplay() {
    const ol = document.getElementById('topScores');
    ol.innerHTML = '';
    leaderboard.forEach(entry => {
        const li = document.createElement('li');
        li.textContent = `${entry.name}: ${entry.score}`;
        ol.appendChild(li);
    });
}

// Initialize game
function startGame() {
    const nameInput = document.getElementById('nameInput');
    const nameField = document.getElementById('playerName');
    playerName = nameField.value.trim();
    
    if (playerName) {
        nameInput.style.display = 'none';
        gameRunning = true;
        resetGame();
    }
}

// Update game over handling
function gameOver() {
    gameRunning = false;
    gameOverDisplay.style.display = 'block';
    finalScoreDisplay.textContent = score;
    saveScore(playerName, score);
    updateLeaderboardDisplay();
}

// Update the game over instructions
function updateGameOverText() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const instructions = isMobile ? 
        "Swipe left/right to move<br>Tap to jump" :
        "Press Space to Restart";
    
    gameOverDisplay.innerHTML = `
        Game Over!<br>
        Score: <span id="finalScore">${score}</span><br>
        <div id="leaderboard">
            <h3>Top Scores</h3>
            <ol id="topScores"></ol>
        </div>
        ${instructions}
    `;
}

// Initialize the game
loadLeaderboard();
document.getElementById('nameInput').style.display = 'block';
gameRunning = false;

// Start the game
gameLoop();
