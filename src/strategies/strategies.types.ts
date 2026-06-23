import type { BoardSnapshot } from "../game/Board.types";
import type { PlayerSymbol } from "../game/Symbol.types";

export type GameStrategy = {
  readonly boardSize: number;
  getWinner(fields: BoardSnapshot): PlayerSymbol | null;
};
