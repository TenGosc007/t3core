import type { PlayerSymbol } from "./Symbol";

type GameStatusWin = { status: "win"; winner: PlayerSymbol };
type GameStatusDraw = { status: "draw" };
type GameStatusRunning = { status: "running" };

export type GameStatus = GameStatusWin | GameStatusDraw | GameStatusRunning;

export const PlayerMoveStatus = {
  SUCCESS: "success",
  ALREADY_SELECTED: "already_selected",
  GAME_NOT_RUNNING: "game_not_running",
} as const;
export type PlayerMoveStatus =
  (typeof PlayerMoveStatus)[keyof typeof PlayerMoveStatus];

export interface IGame {
  readonly gameStatus: GameStatus;
  readonly currentPlayer: PlayerSymbol;
  savePlayerSelection: (field: number) => void;
  reset: () => void;
  isFieldSelected: (field: number) => boolean;
  savePlayerMove: (index: number) => PlayerMoveStatus;
  getBoard: () => (number | PlayerSymbol)[];
}
