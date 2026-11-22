import type { VariantDescriptor } from "@/game/contracts";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

/** Read-only operations for both live positions and private AI simulations. */
export type GameRules = {
  /**
   * Checks a simulated move against variant rules without mutating the board.
   * @param fields - Position to inspect, using the selected variant's dimensions.
   * @param index - Zero-based row-major candidate cell.
   * @param player - Symbol to place; session turn ownership is validated separately.
   * @returns Whether the move is legal for these rules.
   */
  readonly isLegalMove: (fields: BoardSnapshot, index: number, player: PlayerSymbol) => boolean;
  /**
   * Lists legal moves without applying them.
   * @param fields - Position to inspect, using the selected variant's dimensions.
   * @param player - Symbol for which moves are requested.
   * @returns Read-only zero-based cell indices; empty for a terminal position.
   */
  readonly getLegalMoves: (fields: BoardSnapshot, player: PlayerSymbol) => readonly number[];
  /**
   * Evaluates a live or simulated position without changing it.
   * @param fields - Position using the selected variant's dimensions.
   * @returns Read-only running, win or draw result.
   */
  readonly getStatus: (fields: BoardSnapshot) => Readonly<GameStatus>;
};

/** Internal rule strategy; board construction remains owned by Game. */
export type GameStrategy = GameRules & {
  readonly descriptor: VariantDescriptor;
  readonly boardSize: number;
  getWinner(fields: BoardSnapshot): PlayerSymbol | null;
};
