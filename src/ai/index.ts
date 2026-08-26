// Public AI API — re-exported from `src/index.ts` as `t3core`.
//
// Layout:
// - `types.ts`        — `MoveStrategy` contract + `MoveStrategyError`.
// - `difficulty.ts`   — `AIDifficulty`, `AIOptions`, `AIMoveResult` (engine-agnostic).
// - `rng.ts`          — `mulberry32` (shared by all engines).
// - `engines/<name>/` — one folder per algorithm, each with its own barrel.

// Contract + errors.
export type { MoveStrategy, MoveContext, GameView } from "./types";
export { MoveStrategyError } from "./types";

// Difficulty + functional-API options.
export { AIDifficulty } from "./difficulty";
export type { AIOptions, AIMoveResult } from "./difficulty";

// Shared RNG.
export { mulberry32 } from "./rng";

// Engines.
export {
  AlphaBetaStrategy,
  getBestMove,
  ALPHA_BETA_CONFIG,
  alphaBeta,
  MOVE_ORDER_3X3,
  type AlphaBetaOptions,
  type Score,
  WIN_SCORE,
  LOSS_SCORE,
  DRAW_SCORE,
} from "./engines/alphabeta";

export { RandomStrategy } from "./engines/random";
