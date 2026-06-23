import type { BoardSnapshot } from "../types/Board.types";
import type { PlayerSymbol } from "../types/Symbol.types";

export type GameStrategy = {
  readonly boardSize: number;
  getWinner(fields: BoardSnapshot): PlayerSymbol | null;
};
