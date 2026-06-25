/**
 * Unit tests for the pixelRacers Pinia store (src/stores/pixelRacers.ts).
 *
 * The store is a self-contained "light cycle" game engine. Tests cover:
 *  - Getters: aliveBikes, aliveOpponents
 *  - Lifecycle: startGame, setupRound, initializeRound, nextRound,
 *    restartRound, exitGame
 *  - Cell occupancy + bounds helpers: markOccupied, isOccupied, isInBounds
 *  - Player input: changePlayerDirection (incl. 180-degree turn rejection)
 *  - Movement + collision: moveBike
 *  - Opponent AI: updateOpponentDirection (Math.random mocked for determinism)
 *  - Frame tick: updateGame (guards on state/pause)
 *  - Win/loss resolution: checkGameState (victory timers mocked)
 *
 * gridSize is 60 by default, so derived spawn coordinates are:
 *   player    -> (15, 30)     floor(60*0.25), floor(60/2)
 *   opponent0 -> (45, 30)     floor(60*0.75), floor(60/(round+1)) * 1
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  Direction,
  usePixelRacersStore,
  type Bike,
} from "../pixelRacers";

function makeBike(overrides: Partial<Bike> = {}): Bike {
  return {
    id: "bike",
    position: { x: 10, y: 10 },
    direction: Direction.RIGHT,
    trail: [{ x: 10, y: 10 }],
    color: "opponent",
    isPlayer: false,
    alive: true,
    ...overrides,
  };
}

describe("pixelRacers store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in the menu with no bikes", () => {
    const store = usePixelRacersStore();

    expect(store.isGameActive).toBe(false);
    expect(store.gameState).toBe("menu");
    expect(store.currentRound).toBe(1);
    expect(store.player).toBeNull();
    expect(store.opponents).toEqual([]);
    expect(store.aliveBikes).toEqual([]);
    expect(store.aliveOpponents).toEqual([]);
  });

  describe("getters", () => {
    it("aliveBikes includes the player only when alive and excludes dead opponents", () => {
      const store = usePixelRacersStore();
      store.player = makeBike({ id: "player", isPlayer: true, alive: true });
      store.opponents = [
        makeBike({ id: "o1", alive: true }),
        makeBike({ id: "o2", alive: false }),
      ];

      expect(store.aliveBikes.map((b) => b.id)).toEqual(["player", "o1"]);
      expect(store.aliveOpponents.map((b) => b.id)).toEqual(["o1"]);
    });

    it("aliveBikes omits a dead player", () => {
      const store = usePixelRacersStore();
      store.player = makeBike({ id: "player", isPlayer: true, alive: false });
      store.opponents = [makeBike({ id: "o1", alive: true })];

      expect(store.aliveBikes.map((b) => b.id)).toEqual(["o1"]);
    });
  });

  describe("setupRound", () => {
    it("creates the player at the left-center and one opponent for round 1", () => {
      const store = usePixelRacersStore();

      store.setupRound();

      expect(store.player).toMatchObject({
        id: "player",
        position: { x: 15, y: 30 },
        direction: Direction.RIGHT,
        isPlayer: true,
        alive: true,
      });
      expect(store.player?.trail).toEqual([{ x: 15, y: 30 }]);

      expect(store.opponents).toHaveLength(1);
      expect(store.opponents[0]).toMatchObject({
        id: "opponent-0",
        position: { x: 45, y: 30 },
        direction: Direction.LEFT,
        isPlayer: false,
      });

      expect(store.isOccupied(15, 30)).toBe(true);
      expect(store.isOccupied(45, 30)).toBe(true);
    });

    it("spawns one opponent per current round", () => {
      const store = usePixelRacersStore();
      store.currentRound = 3;

      store.setupRound();

      expect(store.opponents.map((o) => o.id)).toEqual([
        "opponent-0",
        "opponent-1",
        "opponent-2",
      ]);
    });

    it("clears stale occupancy from a prior round", () => {
      const store = usePixelRacersStore();
      store.markOccupied(1, 1);

      store.setupRound();

      expect(store.isOccupied(1, 1)).toBe(false);
    });
  });

  describe("lifecycle", () => {
    it("startGame activates the game and begins playing at round 1", () => {
      const store = usePixelRacersStore();

      store.startGame();

      expect(store.isGameActive).toBe(true);
      expect(store.currentRound).toBe(1);
      expect(store.gameState).toBe("playing");
      expect(store.player).not.toBeNull();
    });

    it("initializeRound sets state to playing", () => {
      const store = usePixelRacersStore();
      store.initializeRound();
      expect(store.gameState).toBe("playing");
    });

    it("nextRound increments the round and re-initializes", () => {
      const store = usePixelRacersStore();
      store.startGame();

      store.nextRound();

      expect(store.currentRound).toBe(2);
      expect(store.opponents).toHaveLength(2);
      expect(store.gameState).toBe("playing");
    });

    it("restartRound keeps the round but rebuilds it", () => {
      const store = usePixelRacersStore();
      store.currentRound = 2;
      store.restartRound();

      expect(store.currentRound).toBe(2);
      expect(store.gameState).toBe("playing");
      expect(store.opponents).toHaveLength(2);
    });

    it("exitGame resets all game state back to the menu", () => {
      const store = usePixelRacersStore();
      store.startGame();
      store.currentRound = 4;

      store.exitGame();

      expect(store.isGameActive).toBe(false);
      expect(store.gameState).toBe("menu");
      expect(store.currentRound).toBe(1);
      expect(store.player).toBeNull();
      expect(store.opponents).toEqual([]);
      expect(store.isOccupied(15, 30)).toBe(false);
    });
  });

  describe("occupancy and bounds helpers", () => {
    it("marks and reads occupied cells", () => {
      const store = usePixelRacersStore();

      expect(store.isOccupied(5, 7)).toBe(false);
      store.markOccupied(5, 7);
      expect(store.isOccupied(5, 7)).toBe(true);
    });

    it.each([
      { x: 0, y: 0, expected: true },
      { x: 59, y: 59, expected: true },
      { x: -1, y: 0, expected: false },
      { x: 0, y: -1, expected: false },
      { x: 60, y: 0, expected: false },
      { x: 0, y: 60, expected: false },
    ])("isInBounds($x, $y) === $expected", ({ x, y, expected }) => {
      const store = usePixelRacersStore();
      expect(store.isInBounds(x, y)).toBe(expected);
    });
  });

  describe("changePlayerDirection", () => {
    it("updates the direction for a perpendicular turn", () => {
      const store = usePixelRacersStore();
      store.player = makeBike({
        id: "player",
        isPlayer: true,
        direction: Direction.RIGHT,
      });

      store.changePlayerDirection(Direction.UP);

      expect(store.player.direction).toBe(Direction.UP);
    });

    it.each([
      [Direction.UP, Direction.DOWN],
      [Direction.DOWN, Direction.UP],
      [Direction.LEFT, Direction.RIGHT],
      [Direction.RIGHT, Direction.LEFT],
    ])("rejects the 180-degree turn from %s to %s", (current, attempted) => {
      const store = usePixelRacersStore();
      store.player = makeBike({
        id: "player",
        isPlayer: true,
        direction: current,
      });

      store.changePlayerDirection(attempted);

      expect(store.player.direction).toBe(current);
    });

    it("ignores input when there is no player", () => {
      const store = usePixelRacersStore();
      expect(() => store.changePlayerDirection(Direction.UP)).not.toThrow();
    });

    it("ignores input when the player is dead", () => {
      const store = usePixelRacersStore();
      store.player = makeBike({
        id: "player",
        isPlayer: true,
        direction: Direction.RIGHT,
        alive: false,
      });

      store.changePlayerDirection(Direction.UP);

      expect(store.player.direction).toBe(Direction.RIGHT);
    });
  });

  describe("moveBike", () => {
    it("advances the bike, extends its trail, and marks the new cell occupied", () => {
      const store = usePixelRacersStore();
      const bike = makeBike({ position: { x: 10, y: 10 }, direction: Direction.RIGHT });

      const moved = store.moveBike(bike);

      expect(moved).toBe(true);
      expect(bike.position).toEqual({ x: 11, y: 10 });
      expect(bike.trail).toEqual([
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ]);
      expect(store.isOccupied(11, 10)).toBe(true);
    });

    it.each([
      { direction: Direction.UP, expected: { x: 10, y: 9 } },
      { direction: Direction.DOWN, expected: { x: 10, y: 11 } },
      { direction: Direction.LEFT, expected: { x: 9, y: 10 } },
      { direction: Direction.RIGHT, expected: { x: 11, y: 10 } },
    ])("moves one cell toward $direction", ({ direction, expected }) => {
      const store = usePixelRacersStore();
      const bike = makeBike({ position: { x: 10, y: 10 }, direction });

      store.moveBike(bike);

      expect(bike.position).toEqual(expected);
    });

    it("kills the bike and stops it when it would leave the grid", () => {
      const store = usePixelRacersStore();
      const bike = makeBike({ position: { x: 0, y: 10 }, direction: Direction.LEFT });

      const moved = store.moveBike(bike);

      expect(moved).toBe(false);
      expect(bike.alive).toBe(false);
      expect(bike.position).toEqual({ x: 0, y: 10 });
    });

    it("kills the bike when it runs into an occupied cell", () => {
      const store = usePixelRacersStore();
      store.markOccupied(11, 10);
      const bike = makeBike({ position: { x: 10, y: 10 }, direction: Direction.RIGHT });

      const moved = store.moveBike(bike);

      expect(moved).toBe(false);
      expect(bike.alive).toBe(false);
    });

    it("does nothing for an already-dead bike", () => {
      const store = usePixelRacersStore();
      const bike = makeBike({ alive: false, position: { x: 10, y: 10 } });

      const moved = store.moveBike(bike);

      expect(moved).toBe(false);
      expect(bike.position).toEqual({ x: 10, y: 10 });
    });
  });

  describe("updateOpponentDirection", () => {
    it("does nothing for a dead opponent", () => {
      const store = usePixelRacersStore();
      const opponent = makeBike({ alive: false, direction: Direction.LEFT });

      store.updateOpponentDirection(opponent);

      expect(opponent.direction).toBe(Direction.LEFT);
    });

    it("keeps going straight when straight is valid and the AI rolls below 0.7", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const store = usePixelRacersStore();
      const opponent = makeBike({
        position: { x: 30, y: 30 },
        direction: Direction.LEFT,
      });

      store.updateOpponentDirection(opponent);

      expect(opponent.direction).toBe(Direction.LEFT);
    });

    it("turns when straight is blocked, picking from the valid directions", () => {
      // Block straight (LEFT -> 29,30) so only UP/DOWN remain valid.
      const store = usePixelRacersStore();
      store.markOccupied(29, 30);
      vi.spyOn(Math, "random").mockReturnValue(0); // picks index 0 -> UP
      const opponent = makeBike({
        position: { x: 30, y: 30 },
        direction: Direction.LEFT,
      });

      store.updateOpponentDirection(opponent);

      expect(opponent.direction).toBe(Direction.UP);
    });

    it("keeps the current direction when boxed in with no safe move", () => {
      const store = usePixelRacersStore();
      // Surround (30,30): block UP, DOWN, and straight LEFT. RIGHT is the
      // backwards direction and is excluded regardless.
      store.markOccupied(30, 29); // UP
      store.markOccupied(30, 31); // DOWN
      store.markOccupied(29, 30); // LEFT (straight)
      const opponent = makeBike({
        position: { x: 30, y: 30 },
        direction: Direction.LEFT,
      });

      store.updateOpponentDirection(opponent);

      expect(opponent.direction).toBe(Direction.LEFT);
    });
  });

  describe("updateGame", () => {
    it("is a no-op when not playing", () => {
      const store = usePixelRacersStore();
      store.setupRound();
      store.gameState = "menu";
      const playerPos = { ...store.player!.position };

      store.updateGame();

      expect(store.player!.position).toEqual(playerPos);
    });

    it("is a no-op while paused", () => {
      const store = usePixelRacersStore();
      store.initializeRound();
      store.isPaused = true;
      const playerPos = { ...store.player!.position };

      store.updateGame();

      expect(store.player!.position).toEqual(playerPos);
    });

    it("advances the player and opponents on a normal tick", () => {
      // Keep opponent AI deterministic and going straight.
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const store = usePixelRacersStore();
      store.initializeRound();
      const playerStart = { ...store.player!.position };
      const opponentStart = { ...store.opponents[0].position };

      store.updateGame();

      expect(store.player!.position).not.toEqual(playerStart);
      expect(store.opponents[0].position).not.toEqual(opponentStart);
    });
  });

  describe("checkGameState", () => {
    it("exits the game immediately when the player is dead", () => {
      const store = usePixelRacersStore();
      store.startGame();
      store.player!.alive = false;

      store.checkGameState();

      expect(store.isGameActive).toBe(false);
      expect(store.gameState).toBe("menu");
      expect(store.player).toBeNull();
    });

    it("does nothing while opponents remain alive", () => {
      const store = usePixelRacersStore();
      store.initializeRound();

      store.checkGameState();

      expect(store.gameState).toBe("playing");
      expect(store.isPaused).toBe(false);
      expect(store.isVictoryAnimating).toBe(false);
    });

    it("triggers the victory sequence and advances the round via timers", () => {
      vi.useFakeTimers();
      try {
        const store = usePixelRacersStore();
        store.initializeRound();
        // Kill every opponent so the player wins.
        store.opponents.forEach((o) => (o.alive = false));

        store.checkGameState();

        // Immediately enters paused victory animation.
        expect(store.isPaused).toBe(true);
        expect(store.isVictoryAnimating).toBe(true);

        // After the 800ms flash: animation ends, round advances, board rebuilt.
        vi.advanceTimersByTime(800);
        expect(store.isVictoryAnimating).toBe(false);
        expect(store.currentRound).toBe(2);
        expect(store.opponents).toHaveLength(2);

        // After a further 2000ms the round resumes.
        vi.advanceTimersByTime(2000);
        expect(store.gameState).toBe("playing");
        expect(store.isPaused).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
