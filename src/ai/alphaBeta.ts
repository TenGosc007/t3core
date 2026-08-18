import type { BoardField } from "../game/types/Board.types";
import type { PlayerSymbol } from "../game/types/Symbol.types";

import { WINNING_COMBINATIONS_3X3 } from "../strategies/variants/classic3x3";
import { getWinnerFromFields } from "../utils/getWinnerFromFields";

/** Alfa-Beta score. Higher is better for the AI. */
export type Score = number;

export const WIN_SCORE = 10;
export const LOSS_SCORE = -10;
export const DRAW_SCORE = 0;

/** Move ordering for the 3x3 board: center → corners → edges. Maximizes alpha-beta cutoffs. */
export const MOVE_ORDER_3X3: readonly number[] = [4, 0, 2, 6, 8, 1, 3, 5, 7];

/** Options for {@link alphaBeta}. */
export type AlphaBetaOptions = {
  /** Current board state (mutated in place during search, restored before returning). */
  fields: BoardField[];
  /** Current search depth (starts at 0, increments per ply). */
  depth: number;
  /** Best score the maximizing player can guarantee so far. */
  alpha: number;
  /** Best score the minimizing player can guarantee so far. */
  beta: number;
  /** `true` when it is the AI's turn (maximizing `aiSymbol`). */
  isMaximizing: boolean;
  /** Symbol the AI plays. */
  aiSymbol: PlayerSymbol;
  /** Symbol the opponent plays. */
  opponentSymbol: PlayerSymbol;
  /** Maximum search depth. `Infinity` for a full search. */
  maxDepth: number;
};

/**
 * Alfa-Beta search for the classic 3x3 variant. **3x3-only** — win-detection
 * combinations and move ordering are hardcoded for the 9-cell board. Callers
 * MUST validate the board size at the public boundary (see {@link getBestMove}).
 *
 * Scoring: AI win = `WIN_SCORE - depth` (prefers faster wins),
 * AI loss = `LOSS_SCORE + depth` (prefers slower losses), draw = `DRAW_SCORE`.
 */
export function alphaBeta({
  fields,
  depth,
  alpha,
  beta,
  isMaximizing,
  aiSymbol,
  opponentSymbol,
  maxDepth,
}: AlphaBetaOptions): Score {
  const winner = getWinnerFromFields(fields, WINNING_COMBINATIONS_3X3);

  if (winner === aiSymbol) return WIN_SCORE - depth;
  if (winner === opponentSymbol) return LOSS_SCORE + depth;
  if (fields.every((field) => typeof field === "string")) return DRAW_SCORE;
  if (depth >= maxDepth) return DRAW_SCORE;

  if (isMaximizing) {
    let best = LOSS_SCORE + depth;
    for (const index of MOVE_ORDER_3X3) {
      if (typeof fields[index] === "string") continue;

      const original = fields[index];
      fields[index] = aiSymbol;
      const score = alphaBeta({
        fields,
        depth: depth + 1,
        alpha,
        beta,
        isMaximizing: false,
        aiSymbol,
        opponentSymbol,
        maxDepth,
      });
      fields[index] = original;

      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = WIN_SCORE - depth;
  for (const index of MOVE_ORDER_3X3) {
    if (typeof fields[index] === "string") continue;

    const original = fields[index];
    fields[index] = opponentSymbol;
    const score = alphaBeta({
      fields,
      depth: depth + 1,
      alpha,
      beta,
      isMaximizing: true,
      aiSymbol,
      opponentSymbol,
      maxDepth,
    });
    fields[index] = original;

    if (score < best) best = score;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}
