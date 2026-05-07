import type { PlayerSymbol } from "./Symbol";

type GameStatusWin = { status: "win"; winner: PlayerSymbol };
type GameStatusDraw = { status: "draw" };
type GameStatusRunning = { status: "running" };

export type GameStatus = GameStatusWin | GameStatusDraw | GameStatusRunning;

export interface IGame {
  readonly gameStatus: GameStatus;
  readonly currentPlayer: PlayerSymbol;
  savePlayerSelection: (field: number) => void;
  reset: () => void;
  isFieldSelected: (field: number) => boolean;
  getBoard: () => (number | PlayerSymbol)[];
}
