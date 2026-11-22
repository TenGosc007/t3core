import type { PlayerSymbol } from "@/game/types/Symbol.types";

/** Built-in alpha-beta difficulty levels for human-vs-AI and AI-vs-AI modes. */
export const AIDifficulty = {
  /**
   * Casual level. The AI sees only its immediate move (depth 1) and blunders
   * frequently (~30% random moves). Very beatable — intended for players
   * learning the game or wanting a relaxed match.
   */
  NORMAL: "normal",

  /**
   * Strong level. The AI looks 4 plies ahead and blunders rarely (~10% random
   * moves). Search depth and random mistakes keep this level beatable;
   * it does not guarantee perfect play on 3x3.
   */
  HARD: "hard",
} as const;
export type AIDifficulty = (typeof AIDifficulty)[keyof typeof AIDifficulty];

/** Internal options for the stateless `getBestMove` helper. */
export type AIOptions = {
  /** Helper default: `hard`. The public facade's alpha-beta provider defaults to `normal`. */
  difficulty?: AIDifficulty;

  /**
   * Symbol the AI plays. Defaults to `game.currentPlayer`. If supplied, it must
   * match the current player; otherwise `getBestMove` returns `invalid_state`.
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
