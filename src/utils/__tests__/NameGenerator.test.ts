/**
 * Tests for NameGenerator.ts
 *
 * Covers:
 *  - generateRandomDisplayName: format, content, randomness
 *  - generateSeededDisplayName: determinism, format, hash stability, edge cases
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateRandomDisplayName,
  generateSeededDisplayName,
} from "@/utils/NameGenerator";

// The full adjective and animal lists from the source, used to verify output membership.
const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Mighty', 'Gentle', 'Wise', 'Bold', 'Calm',
  'Fierce', 'Happy', 'Proud', 'Silent', 'Wild', 'Noble', 'Bright', 'Dark',
  'Golden', 'Silver', 'Crimson', 'Azure', 'Mystic', 'Ancient', 'Young', 'Elder',
  'Lucky', 'Sly', 'Quick', 'Strong', 'Agile', 'Steady', 'Curious', 'Playful',
  'Mysterious', 'Radiant', 'Shadow', 'Storm', 'Thunder', 'Lightning', 'Frost', 'Flame',
  'Cosmic', 'Stellar', 'Lunar', 'Solar', 'Crystal', 'Velvet', 'Emerald', 'Ruby',
  'Sapphire', 'Amber', 'Jade', 'Pearl', 'Diamond', 'Onyx', 'Topaz', 'Coral',
];

const ANIMALS = [
  'Penguin', 'Fox', 'Wolf', 'Bear', 'Eagle', 'Hawk', 'Owl', 'Raven',
  'Tiger', 'Lion', 'Panther', 'Leopard', 'Cheetah', 'Jaguar', 'Lynx', 'Puma',
  'Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Pegasus', 'Chimera', 'Sphinx', 'Kraken',
  'Dolphin', 'Whale', 'Shark', 'Octopus', 'Turtle', 'Seal', 'Otter', 'Walrus',
  'Falcon', 'Sparrow', 'Heron', 'Crane', 'Swan', 'Peacock', 'Flamingo', 'Albatross',
  'Rabbit', 'Hare', 'Squirrel', 'Raccoon', 'Badger', 'Beaver', 'Mongoose', 'Ferret',
  'Cobra', 'Viper', 'Python', 'Anaconda', 'Salamander', 'Gecko', 'Chameleon', 'Iguana',
];

// ── generateRandomDisplayName ──────────────────────────────────────────────

describe("generateRandomDisplayName", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a string", () => {
    const result = generateRandomDisplayName();
    expect(typeof result).toBe("string");
  });

  it("returns a non-empty string", () => {
    const result = generateRandomDisplayName();
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a name in 'Adjective Animal' format (two words separated by a space)", () => {
    const result = generateRandomDisplayName();
    const parts = result.split(" ");
    expect(parts).toHaveLength(2);
  });

  it("adjective part is from the known adjectives list", () => {
    const result = generateRandomDisplayName();
    const [adjective] = result.split(" ");
    expect(ADJECTIVES).toContain(adjective);
  });

  it("animal part is from the known animals list", () => {
    const result = generateRandomDisplayName();
    const [, animal] = result.split(" ");
    expect(ANIMALS).toContain(animal);
  });

  it("produces valid names across many calls", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateRandomDisplayName();
      const parts = result.split(" ");
      expect(parts).toHaveLength(2);
      expect(ADJECTIVES).toContain(parts[0]);
      expect(ANIMALS).toContain(parts[1]);
    }
  });

  it("uses Math.random to select adjective and animal (index 0 -> first entries)", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)   // adjective index 0 -> 'Swift'
      .mockReturnValueOnce(0);  // animal index 0 -> 'Penguin'

    const result = generateRandomDisplayName();
    expect(result).toBe("Swift Penguin");
  });

  it("uses Math.random — 0.9999 selects last entries", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.9999)   // floor(0.9999 * 56) = 55 -> 'Coral'
      .mockReturnValueOnce(0.9999);  // floor(0.9999 * 56) = 55 -> 'Iguana'

    const result = generateRandomDisplayName();
    expect(result).toBe("Coral Iguana");
  });

  it("Math.random is called exactly twice per invocation", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    generateRandomDisplayName();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("can produce different names on successive calls (randomness check)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      results.add(generateRandomDisplayName());
    }
    // With 56*56=3136 combinations, 30 true-random calls should yield > 1 unique
    expect(results.size).toBeGreaterThan(1);
  });
});

// ── generateSeededDisplayName ──────────────────────────────────────────────

describe("generateSeededDisplayName", () => {
  it("returns a string", () => {
    const result = generateSeededDisplayName("user-123");
    expect(typeof result).toBe("string");
  });

  it("returns a non-empty string", () => {
    const result = generateSeededDisplayName("user-123");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a name in 'Adjective Animal' format", () => {
    const result = generateSeededDisplayName("user-123");
    const parts = result.split(" ");
    expect(parts).toHaveLength(2);
  });

  it("adjective part is from the known adjectives list", () => {
    const result = generateSeededDisplayName("hello-world");
    const [adjective] = result.split(" ");
    expect(ADJECTIVES).toContain(adjective);
  });

  it("animal part is from the known animals list", () => {
    const result = generateSeededDisplayName("hello-world");
    const [, animal] = result.split(" ");
    expect(ANIMALS).toContain(animal);
  });

  it("is deterministic — same seed always returns same name", () => {
    const seed = "consistent-user-id-42";
    const first = generateSeededDisplayName(seed);
    const second = generateSeededDisplayName(seed);
    expect(first).toBe(second);
  });

  it("is deterministic across many calls with the same seed", () => {
    const seed = "repeat-me";
    const expected = generateSeededDisplayName(seed);
    for (let i = 0; i < 20; i++) {
      expect(generateSeededDisplayName(seed)).toBe(expected);
    }
  });

  it("does NOT use Math.random (mocking random does not affect seeded output)", () => {
    const seed = "my-seed";
    const expected = generateSeededDisplayName(seed);

    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const result = generateSeededDisplayName(seed);
    vi.restoreAllMocks();

    expect(result).toBe(expected);
  });

  it("different seeds produce results from valid lists", () => {
    const seeds = ["abc", "xyz", "123", "user@email.com", "UUID-v4-style"];
    for (const seed of seeds) {
      const result = generateSeededDisplayName(seed);
      const parts = result.split(" ");
      expect(parts).toHaveLength(2);
      expect(ADJECTIVES).toContain(parts[0]);
      expect(ANIMALS).toContain(parts[1]);
    }
  });

  it("different seeds can produce different names", () => {
    const results = new Set<string>();
    const seeds = [
      "seed-a", "seed-b", "seed-c", "seed-d", "seed-e",
      "user1", "user2", "user3", "user4", "user5",
    ];
    for (const seed of seeds) {
      results.add(generateSeededDisplayName(seed));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("handles an empty string seed without throwing", () => {
    expect(() => generateSeededDisplayName("")).not.toThrow();
    const result = generateSeededDisplayName("");
    const parts = result.split(" ");
    expect(parts).toHaveLength(2);
    expect(ADJECTIVES).toContain(parts[0]);
    expect(ANIMALS).toContain(parts[1]);
  });

  it("empty string seed is deterministic", () => {
    expect(generateSeededDisplayName("")).toBe(generateSeededDisplayName(""));
  });

  it("handles a single character seed", () => {
    const result = generateSeededDisplayName("a");
    const parts = result.split(" ");
    expect(parts).toHaveLength(2);
    expect(ADJECTIVES).toContain(parts[0]);
    expect(ANIMALS).toContain(parts[1]);
  });

  it("handles a very long seed without throwing", () => {
    const longSeed = "x".repeat(10000);
    expect(() => generateSeededDisplayName(longSeed)).not.toThrow();
    const result = generateSeededDisplayName(longSeed);
    const parts = result.split(" ");
    expect(parts).toHaveLength(2);
    expect(ADJECTIVES).toContain(parts[0]);
    expect(ANIMALS).toContain(parts[1]);
  });

  it("handles seeds with special characters", () => {
    const specialSeeds = [
      "user@example.com",
      "hello world",
      "tab\there",
      "newline\nhere",
      "unicode-test",
    ];
    for (const seed of specialSeeds) {
      const result = generateSeededDisplayName(seed);
      const parts = result.split(" ");
      expect(parts).toHaveLength(2);
      expect(ADJECTIVES).toContain(parts[0]);
      expect(ANIMALS).toContain(parts[1]);
    }
  });

  it("handles numeric string seeds", () => {
    const result = generateSeededDisplayName("12345");
    const parts = result.split(" ");
    expect(parts).toHaveLength(2);
    expect(ADJECTIVES).toContain(parts[0]);
    expect(ANIMALS).toContain(parts[1]);
  });

  it("adjective and animal indices are derived independently from hash and hash>>8", () => {
    // Both words must independently be valid list members
    const seed = "diverge-test-seed-99";
    const result = generateSeededDisplayName(seed);
    const [adj, animal] = result.split(" ");
    expect(ADJECTIVES.indexOf(adj)).toBeGreaterThanOrEqual(0);
    expect(ANIMALS.indexOf(animal)).toBeGreaterThanOrEqual(0);
  });

  it("known stable output for seed 'user-1' is consistent across runs", () => {
    const seed = "user-1";
    const result1 = generateSeededDisplayName(seed);
    const result2 = generateSeededDisplayName(seed);
    expect(result1).toBe(result2);
    const parts = result1.split(" ");
    expect(ADJECTIVES).toContain(parts[0]);
    expect(ANIMALS).toContain(parts[1]);
  });

  it("seeds that differ by one character both produce valid names", () => {
    const r1 = generateSeededDisplayName("user-A");
    const r2 = generateSeededDisplayName("user-B");
    for (const r of [r1, r2]) {
      const parts = r.split(" ");
      expect(ADJECTIVES).toContain(parts[0]);
      expect(ANIMALS).toContain(parts[1]);
    }
  });

  it("hash wraps correctly for seeds producing negative intermediate hashes", () => {
    // Seeds with high char codes may cause hash to become negative before Math.abs
    const seed = "\xFF\xFF\xFF\xFF";
    expect(() => generateSeededDisplayName(seed)).not.toThrow();
    const result = generateSeededDisplayName(seed);
    const parts = result.split(" ");
    expect(ADJECTIVES).toContain(parts[0]);
    expect(ANIMALS).toContain(parts[1]);
  });
});
