import { defineStore } from "pinia";

// Direction enum for bike movement
export enum Direction {
  UP = 0,
  RIGHT = 1,
  DOWN = 2,
  LEFT = 3,
}

// Position interface
export interface Position {
  x: number;
  y: number;
}

// Bike interface for Pixel Racers game
export interface Bike {
  id: string;
  position: Position;
  direction: Direction;
  trail: Position[];
  color: string;
  isPlayer: boolean;
  alive: boolean;
}

// Game state type
export type GameState = 'menu' | 'playing' | 'won' | 'lost';

// Pixel Racers game store
export const usePixelRacersStore = defineStore("pixelRacers", {
  state: () => ({
    isGameActive: false,
    gameState: 'menu' as GameState,
    currentRound: 1,
    gridSize: 60, // 60x60 grid for better gameplay
    player: null as Bike | null,
    opponents: [] as Bike[],
    // Track all occupied cells for fast collision detection
    occupiedCells: new Set<string>(),
    // Paused state for delay between rounds
    isPaused: false,
    // Victory animation state
    isVictoryAnimating: false,
  }),

  getters: {
    aliveBikes(): Bike[] {
      const bikes: Bike[] = [];
      if (this.player?.alive) bikes.push(this.player);
      bikes.push(...this.opponents.filter(b => b.alive));
      return bikes;
    },
    
    aliveOpponents(): Bike[] {
      return this.opponents.filter(b => b.alive);
    },
  },

  actions: {
    // Start a new game (begins playing immediately)
    startGame() {
      this.isGameActive = true;
      this.currentRound = 1;
      this.initializeRound();
    },

    // Setup round (creates bikes but doesn't change game state)
    setupRound() {
      this.occupiedCells.clear();
      
      // Create player bike in the left-center area
      const playerStartX = Math.floor(this.gridSize * 0.25);
      const playerStartY = Math.floor(this.gridSize / 2);
      
      this.player = {
        id: 'player',
        position: { x: playerStartX, y: playerStartY },
        direction: Direction.RIGHT,
        trail: [{ x: playerStartX, y: playerStartY }],
        color: 'player',
        isPlayer: true,
        alive: true,
      };
      
      // Mark player's starting position as occupied
      this.markOccupied(playerStartX, playerStartY);
      
      // Create opponents based on current round
      this.opponents = [];
      for (let i = 0; i < this.currentRound; i++) {
        this.createOpponent(i);
      }
    },

    // Initialize a new round (starts playing)
    initializeRound() {
      this.setupRound();
      this.gameState = 'playing';
    },

    // Create a single opponent
    createOpponent(index: number) {
      // Spawn opponents in the right side of the grid
      const startX = Math.floor(this.gridSize * 0.75);
      const spacing = Math.floor(this.gridSize / (this.currentRound + 1));
      const startY = spacing * (index + 1);
      
      const opponent: Bike = {
        id: `opponent-${index}`,
        position: { x: startX, y: startY },
        direction: Direction.LEFT,
        trail: [{ x: startX, y: startY }],
        color: 'opponent',
        isPlayer: false,
        alive: true,
      };
      
      this.opponents.push(opponent);
      this.markOccupied(startX, startY);
    },

    // Mark a cell as occupied
    markOccupied(x: number, y: number) {
      this.occupiedCells.add(`${x},${y}`);
    },

    // Check if a cell is occupied
    isOccupied(x: number, y: number): boolean {
      return this.occupiedCells.has(`${x},${y}`);
    },

    // Check if position is within bounds
    isInBounds(x: number, y: number): boolean {
      return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
    },

    // Change player direction
    changePlayerDirection(newDirection: Direction) {
      if (!this.player || !this.player.alive) return;
      
      // Prevent 180-degree turns (can't go backwards)
      const currentDir = this.player.direction;
      if (
        (currentDir === Direction.UP && newDirection === Direction.DOWN) ||
        (currentDir === Direction.DOWN && newDirection === Direction.UP) ||
        (currentDir === Direction.LEFT && newDirection === Direction.RIGHT) ||
        (currentDir === Direction.RIGHT && newDirection === Direction.LEFT)
      ) {
        return;
      }
      
      this.player.direction = newDirection;
    },

    // Move a bike one step forward
    moveBike(bike: Bike): boolean {
      if (!bike.alive) return false;
      
      // Calculate next position based on direction
      let nextX = bike.position.x;
      let nextY = bike.position.y;
      
      switch (bike.direction) {
        case Direction.UP:
          nextY--;
          break;
        case Direction.DOWN:
          nextY++;
          break;
        case Direction.LEFT:
          nextX--;
          break;
        case Direction.RIGHT:
          nextX++;
          break;
      }
      
      // Check for collision
      if (!this.isInBounds(nextX, nextY) || this.isOccupied(nextX, nextY)) {
        bike.alive = false;
        return false;
      }
      
      // Move bike
      bike.position = { x: nextX, y: nextY };
      bike.trail.push({ x: nextX, y: nextY });
      this.markOccupied(nextX, nextY);
      
      return true;
    },

    // Simple AI for opponent bikes
    updateOpponentDirection(opponent: Bike) {
      if (!opponent.alive) return;
      
      // Get all possible directions
      const directions = [Direction.UP, Direction.RIGHT, Direction.DOWN, Direction.LEFT];
      const validDirections: Direction[] = [];
      
      // Filter out backwards direction and check which directions are safe
      for (const dir of directions) {
        // Skip backwards direction
        if (
          (opponent.direction === Direction.UP && dir === Direction.DOWN) ||
          (opponent.direction === Direction.DOWN && dir === Direction.UP) ||
          (opponent.direction === Direction.LEFT && dir === Direction.RIGHT) ||
          (opponent.direction === Direction.RIGHT && dir === Direction.LEFT)
        ) {
          continue;
        }
        
        // Check if this direction is safe
        let testX = opponent.position.x;
        let testY = opponent.position.y;
        
        switch (dir) {
          case Direction.UP:
            testY--;
            break;
          case Direction.DOWN:
            testY++;
            break;
          case Direction.LEFT:
            testX--;
            break;
          case Direction.RIGHT:
            testX++;
            break;
        }
        
        if (this.isInBounds(testX, testY) && !this.isOccupied(testX, testY)) {
          validDirections.push(dir);
        }
      }
      
      // If there are valid directions, choose one
      if (validDirections.length > 0) {
        // Prefer continuing straight if possible
        if (validDirections.includes(opponent.direction)) {
          // 70% chance to continue straight
          if (Math.random() < 0.7) {
            return;
          }
        }
        
        // Otherwise pick a random valid direction
        opponent.direction = validDirections[Math.floor(Math.random() * validDirections.length)];
      }
      // If no valid directions, keep current direction and bike will crash
    },

    // Update game state (called each frame)
    updateGame() {
      if (this.gameState !== 'playing' || this.isPaused) return;
      
      // Update opponent AI
      for (const opponent of this.opponents) {
        if (opponent.alive) {
          this.updateOpponentDirection(opponent);
        }
      }
      
      // Move all bikes
      if (this.player) {
        this.moveBike(this.player);
      }
      
      for (const opponent of this.opponents) {
        this.moveBike(opponent);
      }
      
      // Check win/loss conditions
      this.checkGameState();
    },

    // Check win/loss conditions
    checkGameState() {
      if (!this.player?.alive) {
        // Player died - exit game immediately (no retry)
        this.exitGame();
        return;
      }
      
      if (this.aliveOpponents.length === 0 && !this.isPaused) {
        // Player won - trigger victory animation and setup next round
        this.isPaused = true;
        this.isVictoryAnimating = true;
        
        // Flash for 800ms, then setup next round and show starting positions
        setTimeout(() => {
          this.isVictoryAnimating = false;
          this.currentRound++;
          this.setupRound();
          
          // Wait 2 seconds before starting movement
          setTimeout(() => {
            this.gameState = 'playing';
            this.isPaused = false;
          }, 2000);
        }, 800);
      }
    },

    // Next round
    nextRound() {
      this.currentRound++;
      this.initializeRound();
    },

    // Restart current round
    restartRound() {
      this.initializeRound();
    },

    // Exit game
    exitGame() {
      this.isGameActive = false;
      this.gameState = 'menu';
      this.currentRound = 1;
      this.player = null;
      this.opponents = [];
      this.occupiedCells.clear();
    },
  },
});
