import type { AIDifficulty } from "@/ai/difficulty";

/**
 * Per-difficulty knobs for the Alfa-Beta engine.
 * - `maxDepth` caps the Alfa-Beta search.
 * - `mistakeRate` is the probability of a random move (0..1).
 * - `deterministicTieBreak` — `true` picks the first move by move order
 *   (deterministic); `false` picks randomly among tied best moves.
 *
 * `Record<AIDifficulty, ...>` is a closed type — adding a new difficulty level
 * to {@link AIDifficulty} forces a compile error here until a config entry is
 * provided.
 */
export const ALPHA_BETA_CONFIG: Record<
  AIDifficulty,
  { maxDepth: number; mistakeRate: number; deterministicTieBreak: boolean }
> = {
  normal: { maxDepth: 1, mistakeRate: 0.3, deterministicTieBreak: false },
  hard: { maxDepth: 4, mistakeRate: 0.1, deterministicTieBreak: true },
};
