// Game variables
let bird;
let pipes = [];
let score = 0;
let gameState = 'start'; // start, playing, gameOver
let prevGameState = '';
let stateTransition = 0; // 0-1 for transition effects
let loaderAngle = 0;

// UI Elements for leaderboard integration
let viewLeaderboardBtn;
let leaderboardDisplayed = false;

// Sound variables
let audioContext;
let isSoundEnabled = false;

// Visual elements
let clouds = [];
let particles = [];

// Constants
const GRAVITY = 0.6;
const JUMP_FORCE = -10;
const PIPE_WIDTH = 80;
const PIPE_GAP = 150;
const PIPE_SPEED = 3;
const PIPE_SPAWN_RATE = 100; // Frames between pipe spawns
const TRANSITION_SPEED = 0.05;
const CLOUD_COUNT = 5;
let frameCount = 0;

function setup() {
  createCanvas(400, 600);
  
  // Initialize audio context on user interaction to comply with browser policies
  try {
    // Modern browsers
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
    
    // We'll use this flag to know if sound is available
    isSoundEnabled = true;
    
    // Suspend context until user interaction
    if (audioContext.state === 'running') {
      audioContext.suspend();
    }
  } catch (e) {
    console.warn("Web Audio API not supported in this browser");
    isSoundEnabled = false;
  }
  
  // Create leaderboard button
  createLeaderboardButton();
  
  resetGame();
  createClouds();
}

// Create sounds using the Web Audio API
function playSound(type) {
  if (!isSoundEnabled || !audioContext) return;
  
  // Make sure context is running
  if (audioContext.state !== 'running') {
    audioContext.resume();
  }
  
  try {
    // Create oscillator and gain nodes
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure based on sound type
    switch(type) {
      case 'flap':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      case 'score':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
      case 'hit':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
    }
  } catch (e) {
    console.error("Error playing sound:", e);
  }
}

function draw() {
  // Update frame counter
  frameCount++;
  
  updateTransition();
  
  // Sky gradient background
  drawBackground();
  
  // Update and draw clouds
  updateClouds();
  drawClouds();
  
  // Ground
  drawGround();
  
  if (gameState === 'start') {
    drawStartScreen();
  } else if (gameState === 'playing') {
    updateGame();
    drawGame();
    checkCollisions();
  } else if (gameState === 'gameOver') {
    drawGame();
    drawGameOverScreen();
    
    // Show score submission form when game over (if not already displayed)
    if (!leaderboardDisplayed && stateTransition > 0.8) {
      leaderboardDisplayed = true;
      showScoreSubmissionForm(score);
    }
  }
  
  // Draw particles
  updateParticles();
  drawParticles();
  
  // Draw UI buttons
  drawUIButtons();
}

/**
 * Create the leaderboard button UI
 */
function createLeaderboardButton() {
  viewLeaderboardBtn = {
    x: width - 40,
    y: 40,
    width: 30,
    height: 30,
    isHovered: false
  };
}

/**
 * Draw UI buttons for leaderboard interaction
 */
function drawUIButtons() {
  // Only draw the leaderboard button on start or game over screens
  if (gameState === 'start' || gameState === 'gameOver') {
    // Update hover state
    viewLeaderboardBtn.isHovered = 
      mouseX > viewLeaderboardBtn.x - viewLeaderboardBtn.width / 2 && 
      mouseX < viewLeaderboardBtn.x + viewLeaderboardBtn.width / 2 &&
      mouseY > viewLeaderboardBtn.y - viewLeaderboardBtn.height / 2 && 
      mouseY < viewLeaderboardBtn.y + viewLeaderboardBtn.height / 2;
    
    // Draw button
    push();
    noStroke();
    if (viewLeaderboardBtn.isHovered) {
      fill(60, 134, 255); // Brighter blue when hovered
    } else {
      fill(58, 134, 255, 200); // Normal blue with some transparency
    }
    rectMode(CENTER);
    rect(
      viewLeaderboardBtn.x, 
      viewLeaderboardBtn.y, 
      viewLeaderboardBtn.width, 
      viewLeaderboardBtn.height, 
      5 // Rounded corners
    );
    
    // Trophy icon
    fill(255);
    // Trophy cup
    rect(viewLeaderboardBtn.x, viewLeaderboardBtn.y, 10, 12, 2);
    rect(viewLeaderboardBtn.x, viewLeaderboardBtn.y - 7, 16, 2, 1);
    // Trophy handles
    rect(viewLeaderboardBtn.x - 8, viewLeaderboardBtn.y - 2, 3, 8, 1);
    rect(viewLeaderboardBtn.x + 8, viewLeaderboardBtn.y - 2, 3, 8, 1);
    pop();
  }
}

function updateTransition() {
  if (gameState !== prevGameState) {
    stateTransition = 0;
    prevGameState = gameState;
    
    // Reset leaderboard display flag when changing game state
    if (gameState !== 'gameOver') {
      leaderboardDisplayed = false;
    }
  } else if (stateTransition < 1) {
    stateTransition += TRANSITION_SPEED;
  }
}

function drawBackground() {
  // Sky gradient
  for (let y = 0; y < height - 50; y++) {
    const skyColor = lerpColor(
      color(135, 206, 250), // Light sky blue at top
      color(173, 216, 230), // Lighter blue near horizon
      y / (height - 50)
    );
    stroke(skyColor);
    line(0, y, width, y);
  }
  noStroke();
}

function createClouds() {
  clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    addCloud(true);
  }
}

function addCloud(isInitial = false) {
  const cloudX = isInitial ? random(width) : width + 50;
  clouds.push({
    x: cloudX,
    y: random(50, height / 2),
    width: random(40, 100),
    height: random(20, 50),
    speed: random(0.5, 1.5),
    opacity: random(150, 220)
  });
}

function updateClouds() {
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].x -= clouds[i].speed * (gameState === 'playing' ? 1 : 0.3);
    
    if (clouds[i].x + clouds[i].width < -50) {
      clouds.splice(i, 1);
      addCloud();
    }
  }
}

function drawClouds() {
  fill(255);
  noStroke();
  for (let cloud of clouds) {
    fill(255, 255, 255, cloud.opacity);
    ellipse(cloud.x, cloud.y, cloud.width, cloud.height);
    ellipse(cloud.x + cloud.width * 0.3, cloud.y - cloud.height * 0.2, cloud.width * 0.8, cloud.height * 0.9);
    ellipse(cloud.x + cloud.width * 0.6, cloud.y, cloud.width * 0.7, cloud.height * 1.1);
  }
}

function drawGround() {
  // Ground
  fill(139, 69, 19); // Brown
  rect(0, height - 50, width, 50);
  
  // Green grass
  fill(34, 139, 34);
  rect(0, height - 50, width, 15);
  
  // Grass detail
  fill(42, 167, 42);
  for (let i = 0; i < width; i += 15) {
    triangle(
      i, height - 50,
      i + 8, height - 60,
      i + 15, height - 50
    );
  }
}

function resetGame() {
  bird = {
    x: width / 4,
    y: height / 2,
    radius: 15,
    velocity: 0,
    rotation: 0
  };
  pipes = [];
  score = 0;
  frameCount = 0;
  particles = [];
  leaderboardDisplayed = false;
}

function drawStartScreen() {
  // Apply transition effect
  const alpha = 255 * (1 - Math.pow(1 - stateTransition, 2));
  
  textAlign(CENTER, CENTER);
  fill(0, 0, 0, alpha);
  
  // Title
  textSize(42);
  textStyle(BOLD);
  text('FLAPPY BIRD', width / 2, height / 3);
  
  // Instructions
  textSize(18);
  textStyle(NORMAL);
  text('Press SPACE or CLICK to start', width / 2, height / 2);
  
  // Leaderboard hint
  textSize(14);
  text('Click the trophy to view leaderboard', width / 2, height / 2 + 30);
  
  // Sound status
  textSize(12);
  if (isSoundEnabled) {
    text('Sound enabled', width / 2, height / 2 + 55);
  } else {
    text('Sound not available', width / 2, height / 2 + 55);
  }
  
  // Draw example bird with animation
  const birdY = height * 0.6 + sin(frameCount * 0.05) * 10;
  drawBird(width / 2, birdY);
}

function drawGameOverScreen() {
  // Apply transition effect
  const alpha = 255 * (1 - Math.pow(1 - stateTransition, 3));
  
  fill(0, 0, 0, 150 * min(1, stateTransition * 2));
  rect(0, 0, width, height);
  
  textAlign(CENTER, CENTER);
  fill(255, 255, 255, alpha);
  
  // Game over text
  textSize(42);
  textStyle(BOLD);
  text('GAME OVER', width / 2, height / 3);
  
  // Score
  drawPixelScore(width / 2, height / 2, score, 32, CENTER);
  
  // Restart instructions
  textSize(16);
  textStyle(NORMAL);
  text('Press SPACE or CLICK to restart', width / 2, height * 0.6);
  
  // Leaderboard hint
  textSize(14);
  text('Your score will be saved to the leaderboard', width / 2, height * 0.65);
}

function drawPixelScore(x, y, score, size, alignment = LEFT) {
  textAlign(alignment, CENTER);
  textStyle(BOLD);
  
  // Draw shadow
  fill(0, 0, 0, 100);
  textSize(size);
  text(score, x + 3, y + 3);
  
  // Draw main score
  fill(255, 255, 0); // Yellow
  stroke(255, 165, 0); // Orange outline
  strokeWeight(3);
  textSize(size);
  text(score, x, y);
  
  noStroke();
  strokeWeight(1);
}

function updateGame() {
  // Bird physics
  bird.velocity += GRAVITY;
  bird.y += bird.velocity;
  
  // Update bird rotation based on velocity
  bird.rotation = constrain(map(bird.velocity, -10, 15, -PI/4, PI/2), -PI/4, PI/2);
  
  // Prevent bird from going above the screen
  if (bird.y < bird.radius) {
    bird.y = bird.radius;
    bird.velocity = 0;
  }
  
  // Update pipes
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= PIPE_SPEED;
    
    // Score when passing pipe
    if (!pipes[i].passed && pipes[i].x + PIPE_WIDTH < bird.x) {
      score++;
      playSound('score');
      addScoreParticles();
      pipes[i].passed = true;
    }
    
    // Remove pipes that are off screen
    if (pipes[i].x < -PIPE_WIDTH) {
      pipes.splice(i, 1);
    }
  }
  
  // Spawn new pipes
  if (frameCount % PIPE_SPAWN_RATE === 0) {
    addPipe();
  }
}

function addScoreParticles() {
  // Add score animation particles
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: bird.x + 30,
      y: bird.y - 20,
      vx: random(-2, 2),
      vy: random(-5, -2),
      size: random(5, 10),
      alpha: 255,
      color: color(255, 255, 0)
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].x += particles[i].vx;
    particles[i].y += particles[i].vy;
    particles[i].alpha -= 5;
    
    if (particles[i].alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  noStroke();
  for (let p of particles) {
    fill(red(p.color), green(p.color), blue(p.color), p.alpha);
    ellipse(p.x, p.y, p.size);
  }
}

function drawGame() {
  // Draw pipes
  drawPipes();
  
  // Draw bird
  drawBird(bird.x, bird.y);
  
  // Draw score
  drawPixelScore(20, 40, score, 42);
}

function drawPipes() {
  for (let pipe of pipes) {
    // Pipe gradient
    drawPipeWithGradient(pipe.x, 0, PIPE_WIDTH, pipe.topHeight, true);
    drawPipeWithGradient(pipe.x, pipe.topHeight + PIPE_GAP, PIPE_WIDTH, height - (pipe.topHeight + PIPE_GAP), false);
  }
}

function drawPipeWithGradient(x, y, w, h, isTop) {
  // Draw pipe body with gradient
  for (let i = 0; i < w; i++) {
    const gradientPos = i / w;
    const pipeColor = lerpColor(
      color(75, 139, 59), // Dark green
      color(95, 159, 79), // Lighter green
      sin(gradientPos * PI) // Sinusoidal gradient
    );
    fill(pipeColor);
    rect(x + i, y, 1, h);
  }
  
  // Pipe cap (edge)
  fill(75, 139, 59); // Dark green
  rect(x - 5, isTop ? y + h - 15 : y, PIPE_WIDTH + 10, 15);
  
  // Highlight on pipe cap
  fill(95, 159, 79); // Lighter green
  rect(x - 3, isTop ? y + h - 13 : y + 2, PIPE_WIDTH + 6, 5);
}

function drawBird(x, y) {
  push();
  translate(x, y);
  rotate(bird.rotation);
  
  // Bird body
  fill(255, 204, 0); // Yellow
  ellipse(0, 0, bird.radius * 2);
  
  // Bird eye
  fill(255);
  ellipse(bird.radius / 2, -bird.radius / 3, bird.radius / 2);
  fill(0);
  ellipse(bird.radius / 2, -bird.radius / 3, bird.radius / 4);
  
  // Bird beak
  fill(255, 140, 0); // Orange
  triangle(
    bird.radius, 0,
    bird.radius * 1.5, -bird.radius / 4,
    bird.radius * 1.5, bird.radius / 4
  );
  
  // Bird wing
  const wingOffset = sin(frameCount * 0.2) * 3;
  fill(240, 180, 0);
  
  if (gameState === 'playing' && bird.velocity < 0) {
    // Flapping wing when ascending
    ellipse(-bird.radius / 2, bird.radius / 3 - wingOffset, bird.radius, bird.radius / 1.5);
  } else {
    // Normal wing
    ellipse(-bird.radius / 2, bird.radius / 3, bird.radius);
  }
  
  pop();
}

function addPipe() {
  let minHeight = 50;
  let maxHeight = height - 50 - PIPE_GAP - minHeight;
  let topHeight = random(minHeight, maxHeight);
  
  pipes.push({
    x: width,
    topHeight: topHeight,
    passed: false
  });
}

function checkCollisions() {
  // Ground collision
  if (bird.y + bird.radius > height - 50) {
    gameOver();
    return;
  }
  
  // Pipe collision
  for (let pipe of pipes) {
    // Check if bird is within pipe's x-coordinate range
    if (bird.x + bird.radius > pipe.x && bird.x - bird.radius < pipe.x + PIPE_WIDTH) {
      // Check if bird hits top pipe
      if (bird.y - bird.radius < pipe.topHeight) {
        gameOver();
        return;
      }
      // Check if bird hits bottom pipe
      if (bird.y + bird.radius > pipe.topHeight + PIPE_GAP) {
        gameOver();
        return;
      }
    }
  }
}

function gameOver() {
  if (gameState !== 'gameOver') {
    playSound('hit');
    addDeathParticles();
    gameState = 'gameOver';
  }
}

function addDeathParticles() {
  // Add death animation particles
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: bird.x,
      y: bird.y,
      vx: random(-3, 3),
      vy: random(-5, 5),
      size: random(5, 15),
      alpha: 255,
      color: color(255, random(100, 200), 0)
    });
  }
}

function keyPressed() {
  if (key === ' ') {
    handleUserAction();
  }
}

function mousePressed() {
  // Check if leaderboard button was clicked
  if ((gameState === 'start' || gameState === 'gameOver') && 
      viewLeaderboardBtn && viewLeaderboardBtn.isHovered) {
    showLeaderboard();
    return;
  }
  
  handleUserAction();
}

// Support touch events for mobile
function touchStarted() {
  // Need to calculate if the touch was on the leaderboard button
  const touchX = touches[0].x;
  const touchY = touches[0].y;
  
  if ((gameState === 'start' || gameState === 'gameOver') && 
      viewLeaderboardBtn && 
      touchX > viewLeaderboardBtn.x - viewLeaderboardBtn.width / 2 && 
      touchX < viewLeaderboardBtn.x + viewLeaderboardBtn.width / 2 &&
      touchY > viewLeaderboardBtn.y - viewLeaderboardBtn.height / 2 && 
      touchY < viewLeaderboardBtn.y + viewLeaderboardBtn.height / 2) {
    showLeaderboard();
    return false; // Prevents default behavior
  }
  
  handleUserAction();
  return false; // Prevents default behavior
}

// Centralized function for all user interactions
function handleUserAction() {
  // Activate audio context on first interaction (if needed)
  if (isSoundEnabled && audioContext && audioContext.state !== 'running') {
    audioContext.resume();
  }
  
  if (gameState === 'start') {
    gameState = 'playing';
  } else if (gameState === 'playing') {
    bird.velocity = JUMP_FORCE;
    playSound('flap');
  } else if (gameState === 'gameOver') {
    // If a modal is open, don't restart the game
    if (document.getElementById('leaderboardModal').style.display === 'block' ||
        document.getElementById('submitScoreModal').style.display === 'block') {
      return;
    }
    resetGame();
    gameState = 'playing';
  }
} 