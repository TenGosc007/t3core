import type { BoardSnapshot } from "@/game/types/Board.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

/** Strategy implementing the rules of a specific {@link GameVariant}. */
export type GameStrategy = {
  /** Number of fields on the board for this variant. */
  readonly boardSize: number;

  /**
   * Returns the winning player symbol, or `null` if there is no winner yet.
   *
   * Invariant: every index in the winning combinations MUST be in
   * `[0, boardSize)`. Out-of-range indices yield no winner instead of throwing.
   */
  getWinner(fields: BoardSnapshot): PlayerSymbol | null;
};
