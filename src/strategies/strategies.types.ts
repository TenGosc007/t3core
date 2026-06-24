import type { BoardSnapshot } from "../game/types/Board.types";
import type { PlayerSymbol } from "../game/types/Symbol.types";

/** Strategy implementing the rules of a specific {@link GameVariant}. */
export type GameStrategy = {
  /** Number of fields on the board for this variant. */
  readonly boardSize: number;

  /** Returns the winning player symbol, or `null` if there is no winner yet. */
  getWinner(fields: BoardSnapshot): PlayerSymbol | null;
};
