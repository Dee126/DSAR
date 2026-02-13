/**
 * Seeded Pseudo-Random Number Generator (PRNG) — Synthetic Data
 *
 * Implements a simple but effective xoshiro128** PRNG with deterministic seeding.
 * All synthetic data generation uses this instead of Math.random() to ensure
 * reproducible test data across runs.
 *
 * Usage:
 *   const rng = createSeededRandom(42);
 *   rng.next();      // 0..1 float
 *   rng.int(0, 100); // integer in [0, 100]
 *   rng.pick(arr);   // random element from array
 *   rng.shuffle(arr); // Fisher-Yates shuffle (in-place)
 *   rng.chance(0.2);  // true ~20% of the time
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeededRandom {
  /** Returns a float in [0, 1) */
  next(): number;
  /** Returns an integer in [min, max] (inclusive) */
  int(min: number, max: number): number;
  /** Pick a random element from an array */
  pick<T>(arr: readonly T[]): T;
  /** Fisher-Yates shuffle (returns a new array) */
  shuffle<T>(arr: readonly T[]): T[];
  /** Returns true with given probability (0..1) */
  chance(probability: number): boolean;
  /** Returns a random subset of size n from arr */
  sample<T>(arr: readonly T[], n: number): T[];
  /** Returns a random float in [min, max) */
  float(min: number, max: number): number;
  /** The current seed (for inspection) */
  readonly seed: number;
}

// ---------------------------------------------------------------------------
// Implementation: xoshiro128**
// ---------------------------------------------------------------------------

function splitmix32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded PRNG instance.
 * The same seed always produces the same sequence.
 */
export function createSeededRandom(seed: number = 42): SeededRandom {
  const gen = splitmix32(seed);

  function next(): number {
    return gen();
  }

  function int(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Cannot pick from empty array");
    return arr[int(0, arr.length - 1)];
  }

  function shuffle<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function chance(probability: number): boolean {
    return next() < probability;
  }

  function sample<T>(arr: readonly T[], n: number): T[] {
    const shuffled = shuffle(arr);
    return shuffled.slice(0, Math.min(n, arr.length));
  }

  function float(min: number, max: number): number {
    return next() * (max - min) + min;
  }

  return {
    next,
    int,
    pick,
    shuffle,
    chance,
    sample,
    float,
    get seed() {
      return seed;
    },
  };
}
