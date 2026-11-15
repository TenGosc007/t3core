import type { MoveContext, MoveStrategy } from "@/ai/types";
import type { BoardField, BoardSnapshot } from "@/game/types/Board.types";

import { AIDifficulty } from "@/ai/difficulty";
import { mulberry32 } from "@/ai/rng";
import { MoveStrategyError } from "@/ai/types";

import { alphaBeta, MOVE_ORDER_3X3 } from "./alphaBeta";
import { ALPHA_BETA_CONFIG } from "./config";

/**
 * {@link MoveStrategy} backed by Alfa-Beta pruning with per-difficulty knobs.
 *
 * Does **not** delegate to {@link getBestMove} — `getBestMove` takes a
 * {@link GameView} (read-only view of game state), while this strategy
 * receives only a `BoardSnapshot` + {@link MoveContext}. Instead it calls {@link alphaBeta} directly and
 * shares {@link ALPHA_BETA_CONFIG} with `getBestMove` as the single source of
 * truth for difficulty knobs.
 *
 * The RNG is created once per instance (persistent), so a given `seed`
 * produces a reproducible sequence of moves across a whole game. This differs
 * from `getBestMove`, which rebuilds the RNG on every call (same seed → same
 * move every time). The persistent approach is correct for an instance-based
 * strategy: one game = one RNG sequence, reproducible via `seed`.
 */
export class AlphaBetaStrategy implements MoveStrategy {
  private readonly _difficulty: AIDifficulty;
  private readonly _rng: () => number;

  constructor(options: { difficulty?: AIDifficulty; seed?: number } = {}) {
    this._difficulty = options.difficulty ?? AIDifficulty.HARD;
    this._rng =
      options.seed !== undefined ? mulberry32(options.seed) : Math.random;
  }

  async calculateMove(
    board: BoardSnapshot,
    context: MoveContext,
  ): Promise<number> {
    if (board.length !== 9) {
      throw new RangeError(
        `AlphaBetaStrategy supports only the 3x3 variant (9-cell board), got: ${board.length} cells.`,
      );
    }

    const legalIndices = MOVE_ORDER_3X3.filter(
      (i) => typeof board[i] !== "string",
    );
    if (legalIndices.length === 0) {
      throw new MoveStrategyError(
        "no_legal_moves",
        "AlphaBetaStrategy: no legal moves available (board is full).",
      );
    }

    const config = ALPHA_BETA_CONFIG[this._difficulty];

    // Mistake: with probability `mistakeRate`, ignore Alfa-Beta and play a
    // random legal move.
    if (this._rng() < config.mistakeRate) {
      const index = legalIndices[
        Math.floor(this._rng() * legalIndices.length)
      ] as number;
      return index;
    }

    const { aiSymbol, opponentSymbol } = context;
    const fields = [...board] as BoardField[];
    let bestScore = -Infinity;
    let bestIndices: number[] = [];

    for (const index of legalIndices) {
      const original = fields[index] as BoardField;
      fields[index] = aiSymbol;
      const score = alphaBeta({
        fields,
        depth: 1,
        alpha: -Infinity,
        beta: Infinity,
        isMaximizing: false,
        aiSymbol,
        opponentSymbol,
        maxDepth: config.maxDepth,
      });
      fields[index] = original;

      if (score > bestScore) {
        bestScore = score;
        bestIndices = [index];
      } else if (score === bestScore) {
        bestIndices.push(index);
      }
    }

    // Tie-break: deterministic = first by move order; otherwise random among ties.
    const index =
      bestIndices.length === 1 || config.deterministicTieBreak
        ? (bestIndices[0] as number)
        : (bestIndices[Math.floor(this._rng() * bestIndices.length)] as number);
    return index;
  }
}
