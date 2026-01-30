<template>
  <div class="rpg-container" tabindex="0" @keydown="handleKeyDown" ref="gameContainer">
    <div class="rpg-game">
      <!-- Score & Wave Display -->
      <div class="rpg-header">
        <div class="score-display">
          <span class="label">Score:</span>
          <span class="value">{{ content.score }}</span>
        </div>
        <div class="wave-display">
          <span class="label">Wave:</span>
          <span class="value">{{ content.wave }}</span>
        </div>
      </div>

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
            <span v-else-if="getEnemyAt(x, y)" class="enemy" :class="`enemy-${getEnemyAt(x, y)!.type}`">{{ getEnemyEmoji(getEnemyAt(x, y)!.type) }}</span>
            <span v-else-if="getItemAt(x, y) && !getItemAt(x, y)!.collected" class="item" :class="`item-${getItemAt(x, y)!.type}`">{{ getItemEmoji(getItemAt(x, y)!.type) }}</span>
            <span v-else-if="isWall(x, y)" class="wall"></span>
          </div>
        </div>
      </div>

      <!-- Stats Panel -->
      <div class="rpg-stats">
        <div class="stat-bar">
          <span class="stat-label">❤️ HP:</span>
          <div class="health-bar">
            <div 
              class="health-fill player-health" 
              :style="{ width: `${(content.playerHealth / content.playerMaxHealth) * 100}%` }"
            ></div>
          </div>
          <span class="stat-value">{{ content.playerHealth }}/{{ content.playerMaxHealth }}</span>
        </div>
        
        <div class="stat-bar">
          <span class="stat-label">⚔️ ATK:</span>
          <div class="attack-value">{{ content.playerAttack }}</div>
        </div>

        <div class="stat-bar">
          <span class="stat-label">👹 Enemies:</span>
          <div class="enemy-count">{{ aliveEnemies.length }}</div>
        </div>
      </div>

      <!-- Game Messages -->
      <div v-if="content.gameState === 'won'" class="game-message win">
        <div class="message-content">
          <div class="message-title">🎉 Wave {{ content.wave }} Complete!</div>
          <div class="message-score">Score: {{ content.score }}</div>
          <button @click="nextWave" class="reset-btn">Next Wave</button>
          <button @click="resetGame" class="reset-btn secondary">New Game</button>
        </div>
      </div>
      
      <div v-else-if="content.gameState === 'lost'" class="game-message lose">
        <div class="message-content">
          <div class="message-title">💀 Defeated</div>
          <div class="message-score">Final Score: {{ content.score }}</div>
          <div class="message-wave">Reached Wave {{ content.wave }}</div>
          <button @click="resetGame" class="reset-btn">Try Again</button>
        </div>
      </div>

      <!-- Instructions -->
      <div v-if="content.gameState === 'playing'" class="rpg-instructions">
        WASD/Arrows to move • Touch enemies to attack • Collect items!
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, computed } from "vue";
import { useLayoutStore } from "@/stores/layout";
import type { RPGContent } from "@/types/TileContent";

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;

type EnemyType = 'goblin' | 'troll' | 'dragon';
type ItemType = 'health' | 'strength' | 'shield';

const ENEMY_STATS = {
  goblin: { maxHealth: 30, attack: 8, emoji: '👺', points: 10 },
  troll: { maxHealth: 60, attack: 12, emoji: '👹', points: 25 },
  dragon: { maxHealth: 100, attack: 20, emoji: '🐉', points: 50 },
};

const ITEM_EFFECTS = {
  health: { emoji: '❤️', effect: 'heal', value: 30 },
  strength: { emoji: '⚔️', effect: 'attack', value: 5 },
  shield: { emoji: '🛡️', effect: 'maxHealth', value: 20 },
};

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
    const enemyMoveInterval = ref<number | null>(null);

    // Initialize game if needed
    const initializeGame = () => {
      if (props.content.walls.length === 0) {
        generateMap();
        spawnPlayer();
        spawnEnemies(props.content.wave);
        spawnItems(3);
      }
    };

    // Generate procedural map
    const generateMap = () => {
      const walls: Array<[number, number]> = [];
      
      // Outer walls
      for (let x = 0; x < MAP_WIDTH; x++) {
        walls.push([x, 0]);
        walls.push([x, MAP_HEIGHT - 1]);
      }
      for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        walls.push([0, y]);
        walls.push([MAP_WIDTH - 1, y]);
      }
      
      // Random interior obstacles (3-6 walls)
      const numObstacles = Math.floor(Math.random() * 4) + 3;
      for (let i = 0; i < numObstacles; i++) {
        const x = Math.floor(Math.random() * (MAP_WIDTH - 4)) + 2;
        const y = Math.floor(Math.random() * (MAP_HEIGHT - 4)) + 2;
        if (!walls.some(([wx, wy]) => wx === x && wy === y)) {
          walls.push([x, y]);
          // Occasionally add adjacent wall
          if (Math.random() > 0.5) {
            const dx = Math.random() > 0.5 ? 1 : -1;
            walls.push([x + dx, y]);
          }
        }
      }
      
      props.content.walls = walls;
    };

    const isPositionValid = (x: number, y: number): boolean => {
      if (x < 1 || x >= MAP_WIDTH - 1 || y < 1 || y >= MAP_HEIGHT - 1) return false;
      if (isWall(x, y)) return false;
      if (props.content.playerX === x && props.content.playerY === y) return false;
      if (props.content.enemies.some(e => e.x === x && e.y === y)) return false;
      return true;
    };

    const findRandomPosition = (): [number, number] => {
      let attempts = 0;
      while (attempts < 50) {
        const x = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
        const y = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        if (isPositionValid(x, y)) return [x, y];
        attempts++;
      }
      return [1, 1];
    };

    const spawnPlayer = () => {
      const [x, y] = findRandomPosition();
      props.content.playerX = x;
      props.content.playerY = y;
    };

    const spawnEnemies = (wave: number) => {
      const baseCount = Math.min(2 + Math.floor(wave / 2), 6);
      const enemies: RPGContent['enemies'] = [];
      
      for (let i = 0; i < baseCount; i++) {
        const [x, y] = findRandomPosition();
        const types: EnemyType[] = ['goblin', 'goblin', 'troll'];
        if (wave >= 3) types.push('dragon');
        const type = types[Math.floor(Math.random() * types.length)];
        const stats = ENEMY_STATS[type];
        const waveMultiplier = 1 + (wave - 1) * 0.2;
        
        enemies.push({
          id: `enemy-${Date.now()}-${i}`,
          x,
          y,
          type,
          health: Math.floor(stats.maxHealth * waveMultiplier),
          maxHealth: Math.floor(stats.maxHealth * waveMultiplier),
          attack: Math.floor(stats.attack * waveMultiplier),
        });
      }
      
      props.content.enemies = enemies;
    };

    const spawnItems = (count: number) => {
      const items: RPGContent['items'] = [];
      const types: ItemType[] = ['health', 'strength', 'shield'];
      
      for (let i = 0; i < count; i++) {
        const [x, y] = findRandomPosition();
        items.push({
          id: `item-${Date.now()}-${i}`,
          x,
          y,
          type: types[Math.floor(Math.random() * types.length)],
          collected: false,
        });
      }
      
      props.content.items = items;
    };

    const isWall = (x: number, y: number): boolean => {
      return props.content.walls.some(([wx, wy]) => wx === x && wy === y);
    };

    const isPlayer = (x: number, y: number): boolean => {
      return props.content.playerX === x && props.content.playerY === y;
    };

    const getEnemyAt = (x: number, y: number) => {
      return props.content.enemies.find(e => e.x === x && e.y === y && e.health > 0);
    };

    const getItemAt = (x: number, y: number) => {
      return props.content.items.find(i => i.x === x && i.y === y);
    };

    const getEnemyEmoji = (type: EnemyType): string => {
      return ENEMY_STATS[type].emoji;
    };

    const getItemEmoji = (type: ItemType): string => {
      return ITEM_EFFECTS[type].emoji;
    };

    const aliveEnemies = computed(() => {
      return props.content.enemies.filter(e => e.health > 0);
    });

    const getCellClass = (x: number, y: number): string => {
      if (isWall(x, y)) return 'has-wall';
      if (isPlayer(x, y)) return 'has-player';
      if (getEnemyAt(x, y)) return 'has-enemy';
      if (getItemAt(x, y) && !getItemAt(x, y)!.collected) return 'has-item';
      return '';
    };

    const isAdjacent = (x1: number, y1: number, x2: number, y2: number): boolean => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    };

    const collectItem = (item: RPGContent['items'][0]) => {
      item.collected = true;
      const effect = ITEM_EFFECTS[item.type];
      
      switch (effect.effect) {
        case 'heal':
          props.content.playerHealth = Math.min(
            props.content.playerMaxHealth,
            props.content.playerHealth + effect.value
          );
          break;
        case 'attack':
          props.content.playerAttack += effect.value;
          break;
        case 'maxHealth':
          props.content.playerMaxHealth += effect.value;
          props.content.playerHealth += effect.value;
          break;
      }
      
      layoutStore.saveLayout();
    };

    const combat = (enemy: RPGContent['enemies'][0]) => {
      if (enemy.health <= 0) return;

      // Player attacks enemy
      const variance = Math.floor(Math.random() * 6) - 3;
      const playerDamage = Math.max(1, props.content.playerAttack + variance);
      enemy.health = Math.max(0, enemy.health - playerDamage);

      // Check if enemy is defeated
      if (enemy.health <= 0) {
        const points = ENEMY_STATS[enemy.type].points;
        props.content.score += points;
        
        // Check if all enemies defeated
        if (aliveEnemies.value.length === 0) {
          props.content.gameState = 'won';
        }
        
        layoutStore.saveLayout();
        return;
      }

      // Enemy counterattacks
      const enemyVariance = Math.floor(Math.random() * 4) - 2;
      const enemyDamage = Math.max(1, enemy.attack + enemyVariance);
      props.content.playerHealth = Math.max(0, props.content.playerHealth - enemyDamage);

      // Check if player is defeated
      if (props.content.playerHealth <= 0) {
        props.content.gameState = 'lost';
        stopEnemyAI();
      }

      layoutStore.saveLayout();
    };

    const movePlayer = (dx: number, dy: number) => {
      if (props.content.gameState !== 'playing') return;

      const newX = props.content.playerX + dx;
      const newY = props.content.playerY + dy;

      // Check bounds and walls
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;
      if (isWall(newX, newY)) return;

      // Check if moving onto enemy - attack instead
      const enemy = getEnemyAt(newX, newY);
      if (enemy) {
        combat(enemy);
        return;
      }

      // Move player
      props.content.playerX = newX;
      props.content.playerY = newY;

      // Check for item collection
      const item = getItemAt(newX, newY);
      if (item && !item.collected) {
        collectItem(item);
      } else {
        layoutStore.saveLayout();
      }
    };

    const moveEnemies = () => {
      if (props.content.gameState !== 'playing') return;
      
      props.content.enemies.forEach(enemy => {
        if (enemy.health <= 0) return;
        
        // 50% chance to move each turn
        if (Math.random() > 0.5) return;
        
        const dx = props.content.playerX - enemy.x;
        const dy = props.content.playerY - enemy.y;
        const distance = Math.abs(dx) + Math.abs(dy);
        
        // Only move if player is within range (6 tiles)
        if (distance > 6) return;
        
        // Move toward player
        let moveX = 0;
        let moveY = 0;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          moveX = dx > 0 ? 1 : -1;
        } else {
          moveY = dy > 0 ? 1 : -1;
        }
        
        const newX = enemy.x + moveX;
        const newY = enemy.y + moveY;
        
        // Check if valid move
        if (isWall(newX, newY)) return;
        if (props.content.enemies.some(e => e.x === newX && e.y === newY && e.id !== enemy.id)) return;
        
        // Check if attacking player
        if (newX === props.content.playerX && newY === props.content.playerY) {
          combat(enemy);
          return;
        }
        
        enemy.x = newX;
        enemy.y = newY;
      });
      
      layoutStore.saveLayout();
    };

    const startEnemyAI = () => {
      stopEnemyAI();
      enemyMoveInterval.value = window.setInterval(moveEnemies, 800);
    };

    const stopEnemyAI = () => {
      if (enemyMoveInterval.value) {
        clearInterval(enemyMoveInterval.value);
        enemyMoveInterval.value = null;
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

    const nextWave = () => {
      props.content.wave += 1;
      props.content.gameState = 'playing';
      
      // Heal player partially
      props.content.playerHealth = Math.min(
        props.content.playerMaxHealth,
        props.content.playerHealth + 30
      );
      
      // Generate new map and spawn entities
      generateMap();
      spawnPlayer();
      spawnEnemies(props.content.wave);
      spawnItems(Math.min(3 + Math.floor(props.content.wave / 2), 6));
      
      layoutStore.saveLayout();
      startEnemyAI();
      gameContainer.value?.focus();
    };

    const resetGame = () => {
      props.content.playerX = 1;
      props.content.playerY = 1;
      props.content.playerHealth = 100;
      props.content.playerMaxHealth = 100;
      props.content.playerAttack = 15;
      props.content.enemies = [];
      props.content.items = [];
      props.content.walls = [];
      props.content.score = 0;
      props.content.wave = 1;
      props.content.gameState = 'playing';
      
      initializeGame();
      layoutStore.saveLayout();
      startEnemyAI();
      gameContainer.value?.focus();
    };

    onMounted(() => {
      initializeGame();
      if (props.content.gameState === 'playing') {
        startEnemyAI();
      }
      gameContainer.value?.focus();
    });

    onUnmounted(() => {
      stopEnemyAI();
    });

    return {
      MAP_WIDTH,
      MAP_HEIGHT,
      gameContainer,
      handleKeyDown,
      getCellClass,
      isWall,
      isPlayer,
      getEnemyAt,
      getItemAt,
      getEnemyEmoji,
      getItemEmoji,
      aliveEnemies,
      resetGame,
      nextWave,
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
  gap: 8px;
  position: relative;
}

.rpg-header {
  display: flex;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.4);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.score-display, .wave-display {
  display: flex;
  gap: 6px;
  align-items: center;
}

.score-display .label, .wave-display .label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.score-display .value, .wave-display .value {
  color: #fbbf24;
  font-weight: 700;
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

.rpg-cell.has-item {
  background: rgba(255, 215, 0, 0.3);
}

.wall {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #555 0%, #333 100%);
  border-radius: 2px;
}

.player {
  animation: bounce 0.5s ease-in-out infinite alternate;
  filter: drop-shadow(0 2px 4px rgba(79, 70, 229, 0.6));
}

.enemy {
  animation: bounce 0.6s ease-in-out infinite alternate;
}

.enemy-goblin {
  filter: drop-shadow(0 2px 4px rgba(239, 68, 68, 0.5));
}

.enemy-troll {
  filter: drop-shadow(0 2px 4px rgba(220, 38, 38, 0.6));
  font-size: 22px;
}

.enemy-dragon {
  filter: drop-shadow(0 2px 4px rgba(239, 68, 68, 0.8));
  font-size: 24px;
  animation: dragonFloat 1s ease-in-out infinite alternate;
}

@keyframes dragonFloat {
  from {
    transform: translateY(-3px);
  }
  to {
    transform: translateY(1px);
  }
}

.item {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
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
  gap: 6px;
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
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  min-width: 60px;
}

.attack-value, .enemy-count {
  font-size: 13px;
  font-weight: 700;
  color: #fbbf24;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
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

.message-score {
  font-size: 16px;
  font-weight: 600;
  color: #fbbf24;
  margin-top: 4px;
}

.message-wave {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
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
  margin: 4px;
}

.reset-btn.secondary {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
}

.reset-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.reset-btn.secondary:hover {
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.4);
}

.reset-btn:active {
  transform: translateY(0);
}

.rpg-instructions {
  text-align: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  padding: 4px;
  line-height: 1.4;
}
</style>
