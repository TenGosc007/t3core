import type { MoveContext, MoveStrategy } from "@/ai/types";
import type { BoardSnapshot } from "@/game/types/Board.types";

import { mulberry32 } from "@/ai/rng";
import { MoveStrategyError } from "@/ai/types";

/**
 * Simplest possible {@link MoveStrategy}: picks a random empty field.
 *
 * No difficulty levels, no board analysis, no blocking. The only guarantee is
 * that the returned index is a legal (empty) field. Useful as a baseline
 * opponent for tests, demos, and difficulty benchmarks (hard vs random →
 * winrate).
 *
 * The RNG is created once per instance (persistent), so a given `seed`
 * produces a reproducible sequence of moves across a whole game — not the
 * same move every turn.
 */
export class RandomStrategy implements MoveStrategy {
  private readonly _rng: () => number;

  constructor(options: { seed?: number } = {}) {
    this._rng =
      options.seed !== undefined ? mulberry32(options.seed) : Math.random;
  }

  async calculateMove(
    board: BoardSnapshot,
    _context: MoveContext,
  ): Promise<number> {
    const legalIndices: number[] = [];
    for (let i = 0; i < board.length; i++) {
      if (typeof board[i] !== "string") legalIndices.push(i);
    }

    if (legalIndices.length === 0) {
      throw new MoveStrategyError(
        "no_legal_moves",
        "RandomStrategy: no legal moves available (board is full).",
      );
    }

    const index = legalIndices[Math.floor(this._rng() * legalIndices.length)];
    return index as number;
  }
}
