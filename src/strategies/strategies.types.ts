import type { VariantDescriptor } from "@/game/contracts";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

/** Read-only operations for both live positions and private AI simulations. */
export type GameRules = {
  readonly isLegalMove: (fields: BoardSnapshot, index: number, player: PlayerSymbol) => boolean;
  readonly getLegalMoves: (fields: BoardSnapshot, player: PlayerSymbol) => readonly number[];
  readonly getStatus: (fields: BoardSnapshot) => Readonly<GameStatus>;
};

/** Internal rule strategy; board construction remains owned by Game. */
export type GameStrategy = GameRules & {
  readonly descriptor: VariantDescriptor;
  readonly boardSize: number;
  getWinner(fields: BoardSnapshot): PlayerSymbol | null;
};
