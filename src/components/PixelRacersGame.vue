<template>
  <Teleport to="body">
    <div v-if="gameStore.isGameActive" class="game-overlay-wrapper">
      <!-- Backdrop for dimming and blurring the app behind -->
      <div class="game-backdrop"></div>
      
      <!-- Full-screen canvas -->
      <canvas ref="canvasRef" class="game-canvas"></canvas>

      <!-- Header with round info -->
      <div class="game-header">
        <div class="round-info">
          <span class="round-label">Round</span>
          <span class="round-number">{{ gameStore.currentRound }}</span>
        </div>
      </div>

      <!-- Controls hint (only show during gameplay) -->
      <div v-if="gameStore.gameState === 'playing'" class="controls-hint">
        WASD / Arrow Keys • ESC to exit
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// Pixel Racers - A fast-paced racing game where you compete against AI opponents
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { usePixelRacersStore, Direction } from '@/stores/pixelRacers';

const gameStore = usePixelRacersStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: number | null = null;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100; // Update game state every 100ms (10 times per second)

// Canvas dimensions
let canvasWidth = 0;
let canvasHeight = 0;
let cellSize = 0;

// Initialize canvas to fill the screen
const initCanvas = () => {
  if (!canvasRef.value) return;
  
  ctx = canvasRef.value.getContext('2d');
  if (!ctx) return;
  
  // Use full viewport dimensions for immersive experience
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  
  // Calculate cell size to fit the grid in the viewport
  const gridPixelSize = Math.min(canvasWidth, canvasHeight) * 0.9;
  cellSize = gridPixelSize / gameStore.gridSize;
  
  canvasRef.value.width = canvasWidth;
  canvasRef.value.height = canvasHeight;
};

// Handle keyboard input
const handleKeyDown = (event: KeyboardEvent) => {
  if (!gameStore.isGameActive) return;
  
  // ESC to exit
  if (event.key === 'Escape') {
    exitGame();
    return;
  }
  
  if (gameStore.gameState !== 'playing') return;
  
  // Direction controls
  switch (event.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      event.preventDefault();
      gameStore.changePlayerDirection(Direction.UP);
      break;
    case 's':
    case 'arrowdown':
      event.preventDefault();
      gameStore.changePlayerDirection(Direction.DOWN);
      break;
    case 'a':
    case 'arrowleft':
      event.preventDefault();
      gameStore.changePlayerDirection(Direction.LEFT);
      break;
    case 'd':
    case 'arrowright':
      event.preventDefault();
      gameStore.changePlayerDirection(Direction.RIGHT);
      break;
  }
};

// Game loop
const gameLoop = (timestamp: number) => {
  if (!ctx || !gameStore.isGameActive) return;
  
  // Update game state at fixed intervals
  if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
    if (gameStore.gameState === 'playing') {
      console.log('Updating game, alive bikes:', gameStore.aliveBikes.length);
      gameStore.updateGame();
    } else {
      console.log('Game state is not playing:', gameStore.gameState);
    }
    lastUpdateTime = timestamp;
  }
  
  // Render every frame for smooth visuals
  render();
  
  animationFrameId = requestAnimationFrame(gameLoop);
};

// Render the game
const render = () => {
  if (!ctx) {
    console.warn('No canvas context available');
    return;
  }
  
  // Clear canvas with semi-transparent dark background
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Calculate offset to center the grid
  const gridPixelSize = cellSize * gameStore.gridSize;
  const offsetX = (canvasWidth - gridPixelSize) / 2;
  const offsetY = (canvasHeight - gridPixelSize) / 2;
  
  // Draw grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= gameStore.gridSize; i++) {
    const pos = i * cellSize;
    
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(offsetX + pos, offsetY);
    ctx.lineTo(offsetX + pos, offsetY + gridPixelSize);
    ctx.stroke();
    
    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + pos);
    ctx.lineTo(offsetX + gridPixelSize, offsetY + pos);
    ctx.stroke();
  }
  
  // Draw trails and bikes
  const bikes = gameStore.aliveBikes;
  
  // Victory animation: flash bikes on/off
  const shouldShowBikes = !gameStore.isVictoryAnimating || Math.floor(performance.now() / 150) % 2 === 0;
  
  for (const bike of bikes) {
    // Determine colors based on bike type
    let bikeColor: string;
    let trailColor: string;
    
    if (bike.isPlayer) {
      bikeColor = '#00FFFF'; // Cyan for player
      trailColor = 'rgba(0, 255, 255, 0.5)'; // Semi-transparent cyan
    } else {
      bikeColor = '#FF6600'; // Orange for opponents
      trailColor = 'rgba(255, 102, 0, 0.5)'; // Semi-transparent orange
    }
    
    // Draw trail (always visible)
    ctx.fillStyle = trailColor;
    for (const pos of bike.trail) {
      ctx.fillRect(
        offsetX + pos.x * cellSize + 1,
        offsetY + pos.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );
    }
    
    // Draw bike (flash during victory animation)
    if (shouldShowBikes) {
      const x = offsetX + bike.position.x * cellSize;
      const y = offsetY + bike.position.y * cellSize;
      
      // Glow effect
      ctx.shadowBlur = 20;
      ctx.shadowColor = bikeColor;
      ctx.fillStyle = bikeColor;
      ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      
      // Reset shadow
      ctx.shadowBlur = 0;
    }
  }
  
  // Draw dead bikes and their trails with reduced opacity
  const deadBikes = [...gameStore.opponents.filter(b => !b.alive)];
  if (gameStore.player && !gameStore.player.alive) {
    deadBikes.push(gameStore.player);
  }
  
  for (const bike of deadBikes) {
    // Determine dimmed colors based on bike type
    let trailColor: string;
    let bikeColor: string;
    
    if (bike.isPlayer) {
      trailColor = 'rgba(0, 255, 255, 0.2)'; // Dimmed cyan trail
      bikeColor = 'rgba(0, 255, 255, 0.3)'; // Slightly brighter bike position
    } else {
      trailColor = 'rgba(255, 102, 0, 0.2)'; // Dimmed orange trail
      bikeColor = 'rgba(255, 102, 0, 0.3)'; // Slightly brighter bike position
    }
    
    // Draw the entire trail for dead bikes (dimmed but visible)
    ctx.fillStyle = trailColor;
    for (const pos of bike.trail) {
      ctx.fillRect(
        offsetX + pos.x * cellSize + 1,
        offsetY + pos.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );
    }
    
    // Draw final bike position slightly brighter
    ctx.fillStyle = bikeColor;
    const pos = bike.position;
    ctx.fillRect(
      offsetX + pos.x * cellSize + 1,
      offsetY + pos.y * cellSize + 1,
      cellSize - 2,
      cellSize - 2
    );
  }
};

// Action handlers
const exitGame = () => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  gameStore.exitGame();
};

const handleOverlayClick = () => {
  // Clicking outside the container does nothing (prevents accidental exits)
};

// Watch for game activation to initialize canvas and start rendering
watch(() => gameStore.isGameActive, (isActive) => {
  if (isActive) {
    // Wait for next tick to ensure canvas ref is available
    nextTick(() => {
      initCanvas();
      if (animationFrameId === null) {
        // Set to 0 so first update happens immediately
        lastUpdateTime = 0;
        animationFrameId = requestAnimationFrame(gameLoop);
        console.log('Game started, game state:', gameStore.gameState, 'Bikes:', gameStore.aliveBikes.length);
      }
    });
  } else {
    // Clean up when game closes
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
});

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', handleResize);
  
  // If game is already active, initialize
  if (gameStore.isGameActive) {
    initCanvas();
    lastUpdateTime = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
    console.log('Game already active on mount, state:', gameStore.gameState);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', handleResize);
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
});

// Watch for window resize
const handleResize = () => {
  if (gameStore.isGameActive && canvasRef.value) {
    initCanvas();
  }
};
</script>

<style scoped lang="scss">
.game-overlay-wrapper {
  position: fixed;
  inset: 0;
  z-index: 1100;
  animation: fadeIn var(--duration-normal) var(--easing-ease-out);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.game-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 1;
}

.game-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 2;
}

.game-header {
  position: absolute;
  top: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xl);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
  z-index: 100;
}

.round-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-family: var(--font-family-base);
}

.round-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.round-number {
  color: #00FFFF;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.exit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.4);
    color: white;
  }
}

.game-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  animation: fadeIn var(--duration-normal) var(--easing-ease-out);
  z-index: 50;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-2xl);
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-lg);
  text-align: center;
  max-width: 500px;
}

.game-title {
  font-size: 3rem;
  font-weight: var(--font-weight-bold);
  color: white;
  margin: 0;
  background: linear-gradient(135deg, #00FFFF, #FF6600);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
}

.game-subtitle {
  font-size: var(--font-size-lg);
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.instructions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  
  p {
    margin: 0;
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-md);
    
    strong {
      color: #00FFFF;
      font-weight: var(--font-weight-semibold);
    }
  }
}

.overlay-title {
  font-size: 2rem;
  font-weight: var(--font-weight-bold);
  color: white;
  margin: 0;
}

.overlay-message {
  font-size: var(--font-size-lg);
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.button-group {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  padding: var(--spacing-sm) var(--spacing-xl);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  border: 1px solid;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
  font-family: var(--font-family-base);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  &.primary {
    background: rgba(0, 255, 255, 0.1);
    border-color: #00FFFF;
    color: #00FFFF;
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
    
    &:hover {
      background: rgba(0, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
    }
  }
  
  &.secondary {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.7);
    
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.5);
      color: white;
      transform: translateY(-2px);
    }
  }
}

.controls-hint {
  position: absolute;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
  text-align: center;
  z-index: 100;
}

.win-overlay {
  .overlay-title {
    color: #24cb71; // var(--color-figma-green)
  }
}

.lose-overlay {
  .overlay-title {
    color: #ff3737; // var(--color-figma-red)
  }
}
</style>
