import type { PlayerSymbol } from "@/game/types/Symbol.types";

/** Selectable AI difficulty levels for Single Player mode. */
export const AIDifficulty = {
  /**
   * Casual level. The AI sees only its immediate move (depth 1) and blunders
   * frequently (~30% random moves). Very beatable — intended for players
   * learning the game or wanting a relaxed match.
   */
  NORMAL: "normal",

  /**
   * Strong level. The AI looks 4 plies ahead and blunders rarely (~10% random
   * moves). On 3x3 this is intentionally not full-depth: a perfect AI would be
   * unbeatable (best result for a perfect opponent is a draw), which would make
   * Single Player pointless. With the 10% mistake rate the player always has a
   * small but real chance to win by capitalizing on a blunder.
   */
  HARD: "hard",
} as const;
export type AIDifficulty = (typeof AIDifficulty)[keyof typeof AIDifficulty];

/** Options for configuring an AI player or a single `getBestMove` call. */
export type AIOptions = {
  /** Difficulty level. Defaults to {@link AIDifficulty.HARD}. */
  difficulty?: AIDifficulty;

  /**
   * Symbol the AI plays. Defaults to the second player's symbol (`"X"` with the
   * default `["O", "X"]` symbols), i.e. the AI moves second.
   */
  symbol?: PlayerSymbol;

  /**
   * Symbol the opponent plays. Inferred from the board when omitted (the first
   * symbol on the board that differs from `symbol`). Required only when the AI
   * moves first on an empty board — in that case the opponent has not appeared
   * on the board yet and the symbol cannot be inferred.
   */
  opponentSymbol?: PlayerSymbol;

  /**
   * Optional seed for the internal RNG. When omitted, `Math.random` is used.
   * Provide a seed for reproducible behavior in tests.
   */
  seed?: number;
};

/** Result of an AI move computation. */
export type AIMoveResult =
  | { status: "success"; index: number }
  | { status: "no_moves" }
  | { status: "invalid_state" };
