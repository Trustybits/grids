<template>
  <div class="rpg-container" tabindex="0" @keydown="handleKeyDown" ref="gameContainer">
    <div class="rpg-game">
      <!-- Game Grid -->
      <div class="rpg-grid">
        <div 
          v-for="(row, y) in MAP_HEIGHT" 
          :key="`row-${y}`" 
          class="rpg-row"
        >
          <div 
            v-for="(col, x) in MAP_WIDTH" 
            :key="`cell-${y}-${x}`"
            class="rpg-cell"
            :class="getCellClass(x, y)"
          >
            <span v-if="isPlayer(x, y)" class="player">🧙</span>
            <span v-else-if="isEnemy(x, y) && content.enemyHealth > 0" class="enemy">👹</span>
            <span v-else-if="isWall(x, y)" class="wall"></span>
          </div>
        </div>
      </div>

      <!-- Stats Panel -->
      <div class="rpg-stats">
        <div class="stat-bar">
          <span class="stat-label">HP:</span>
          <div class="health-bar">
            <div 
              class="health-fill player-health" 
              :style="{ width: `${content.playerHealth}%` }"
            ></div>
          </div>
          <span class="stat-value">{{ content.playerHealth }}</span>
        </div>
        
        <div v-if="content.enemyHealth > 0" class="stat-bar">
          <span class="stat-label">Enemy:</span>
          <div class="health-bar">
            <div 
              class="health-fill enemy-health" 
              :style="{ width: `${content.enemyHealth * 2}%` }"
            ></div>
          </div>
          <span class="stat-value">{{ content.enemyHealth }}</span>
        </div>
      </div>

      <!-- Game Messages -->
      <div v-if="content.gameState === 'won'" class="game-message win">
        <div class="message-content">
          <div class="message-title">🎉 Victory!</div>
          <button @click="resetGame" class="reset-btn">Play Again</button>
        </div>
      </div>
      
      <div v-else-if="content.gameState === 'lost'" class="game-message lose">
        <div class="message-content">
          <div class="message-title">💀 Defeated</div>
          <button @click="resetGame" class="reset-btn">Try Again</button>
        </div>
      </div>

      <!-- Instructions -->
      <div v-if="content.gameState === 'playing'" class="rpg-instructions">
        Use arrow keys or WASD to move. Get close to attack!
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from "vue";
import { useLayoutStore } from "@/stores/layout";
import type { RPGContent } from "@/types/TileContent";

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

// Simple wall layout
const WALLS = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
  [0, 1], [9, 1],
  [0, 2], [3, 2], [6, 2], [9, 2],
  [0, 3], [9, 3],
  [0, 4], [4, 4], [5, 4], [9, 4],
  [0, 5], [9, 5],
  [0, 6], [3, 6], [6, 6], [9, 6],
  [0, 7], [9, 7],
  [0, 8], [9, 8],
  [0, 9], [1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9],
];

export default defineComponent({
  props: {
    content: {
      type: Object as () => RPGContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const gameContainer = ref<HTMLDivElement | null>(null);

    const isWall = (x: number, y: number): boolean => {
      return WALLS.some(([wx, wy]) => wx === x && wy === y);
    };

    const isPlayer = (x: number, y: number): boolean => {
      return props.content.playerX === x && props.content.playerY === y;
    };

    const isEnemy = (x: number, y: number): boolean => {
      return props.content.enemyX === x && props.content.enemyY === y;
    };

    const getCellClass = (x: number, y: number): string => {
      if (isWall(x, y)) return 'has-wall';
      if (isPlayer(x, y)) return 'has-player';
      if (isEnemy(x, y) && props.content.enemyHealth > 0) return 'has-enemy';
      return '';
    };

    const isAdjacent = (x1: number, y1: number, x2: number, y2: number): boolean => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    };

    const combat = () => {
      if (props.content.enemyHealth <= 0) return;

      // Player attacks enemy
      const playerDamage = Math.floor(Math.random() * 15) + 10;
      props.content.enemyHealth = Math.max(0, props.content.enemyHealth - playerDamage);

      // Check if enemy is defeated
      if (props.content.enemyHealth <= 0) {
        props.content.gameState = 'won';
        layoutStore.saveLayout();
        return;
      }

      // Enemy counterattacks
      const enemyDamage = Math.floor(Math.random() * 10) + 5;
      props.content.playerHealth = Math.max(0, props.content.playerHealth - enemyDamage);

      // Check if player is defeated
      if (props.content.playerHealth <= 0) {
        props.content.gameState = 'lost';
      }

      layoutStore.saveLayout();
    };

    const movePlayer = (dx: number, dy: number) => {
      if (props.content.gameState !== 'playing') return;

      const newX = props.content.playerX + dx;
      const newY = props.content.playerY + dy;

      // Check bounds
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;

      // Check walls
      if (isWall(newX, newY)) return;

      // Check if moving onto enemy
      if (newX === props.content.enemyX && newY === props.content.enemyY && props.content.enemyHealth > 0) {
        return; // Can't move onto enemy
      }

      // Move player
      props.content.playerX = newX;
      props.content.playerY = newY;

      // Check if adjacent to enemy for combat
      if (isAdjacent(newX, newY, props.content.enemyX, props.content.enemyY) && props.content.enemyHealth > 0) {
        combat();
      } else {
        layoutStore.saveLayout();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      // Prevent default behavior for game keys
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
      }

      switch (key) {
        case 'arrowup':
        case 'w':
          movePlayer(0, -1);
          break;
        case 'arrowdown':
        case 's':
          movePlayer(0, 1);
          break;
        case 'arrowleft':
        case 'a':
          movePlayer(-1, 0);
          break;
        case 'arrowright':
        case 'd':
          movePlayer(1, 0);
          break;
      }
    };

    const resetGame = () => {
      props.content.playerX = 1;
      props.content.playerY = 1;
      props.content.playerHealth = 100;
      props.content.enemyX = 8;
      props.content.enemyY = 8;
      props.content.enemyHealth = 50;
      props.content.gameState = 'playing';
      layoutStore.saveLayout();
      
      // Refocus on game
      gameContainer.value?.focus();
    };

    onMounted(() => {
      // Auto-focus the game container so keyboard works immediately
      gameContainer.value?.focus();
    });

    return {
      MAP_WIDTH,
      MAP_HEIGHT,
      gameContainer,
      handleKeyDown,
      getCellClass,
      isWall,
      isPlayer,
      isEnemy,
      resetGame,
    };
  },
});
</script>

<style scoped>
.rpg-container {
  width: 100%;
  height: 100%;
  padding: var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  background: linear-gradient(135deg, rgba(20, 20, 40, 0.95) 0%, rgba(40, 20, 60, 0.95) 100%);
}

.rpg-game {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}

.rpg-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.rpg-row {
  display: flex;
  gap: 2px;
}

.rpg-cell {
  aspect-ratio: 1;
  flex: 1;
  background: rgba(50, 50, 70, 0.6);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  position: relative;
  transition: background-color 0.2s ease;
}

.rpg-cell.has-wall {
  background: rgba(80, 80, 100, 0.9);
}

.rpg-cell.has-player {
  background: rgba(50, 100, 200, 0.4);
}

.rpg-cell.has-enemy {
  background: rgba(200, 50, 50, 0.4);
}

.wall {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #555 0%, #333 100%);
  border-radius: 2px;
}

.player, .enemy {
  animation: bounce 0.5s ease-in-out infinite alternate;
}

@keyframes bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-2px);
  }
}

.rpg-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.4);
  padding: 8px;
  border-radius: 6px;
}

.stat-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  min-width: 50px;
}

.health-bar {
  flex: 1;
  height: 14px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.health-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 7px;
}

.player-health {
  background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
}

.enemy-health {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.stat-value {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  min-width: 30px;
  text-align: right;
}

.game-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  padding: 24px 32px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  z-index: 10;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translate(-50%, -40%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.message-title {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.win .message-title {
  color: #4ade80;
}

.lose .message-title {
  color: #ef4444;
}

.reset-btn {
  padding: 8px 24px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.reset-btn:active {
  transform: translateY(0);
}

.rpg-instructions {
  text-align: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  padding: 4px;
}
</style>
