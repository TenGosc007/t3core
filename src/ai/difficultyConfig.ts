import type { AIDifficulty } from "./types";

/**
 * Per-difficulty knobs shared by `getBestMove` and `AlphaBetaStrategy`.
 * - `maxDepth` caps the Alfa-Beta search.
 * - `mistakeRate` is the probability of a random move (0..1).
 */
export const DIFFICULTY_CONFIG: Record<
  AIDifficulty,
  { maxDepth: number; mistakeRate: number }
> = {
  normal: { maxDepth: 1, mistakeRate: 0.3 },
  hard: { maxDepth: 4, mistakeRate: 0.1 },
};

/** Mulberry32 — fast seeded PRNG. Returns a function producing floats in `[0, 1)`. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
