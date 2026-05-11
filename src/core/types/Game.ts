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

export const GameEvent = {
  PLAYER_MOVE: "PLAYER_MOVE",
  RESET: "RESET",
} as const;
export type GameEvent = (typeof GameEvent)[keyof typeof GameEvent];

export type GameEventPayload = {
  board: (number | PlayerSymbol)[];
  currentPlayer: PlayerSymbol;
  gameStatus: GameStatus;
};

export type GameEventMap = {
  [GameEvent.PLAYER_MOVE]: [payload: GameEventPayload & { index: number }];
  [GameEvent.RESET]: [payload: GameEventPayload];
};

export type EventEmit = <K extends keyof GameEventMap>(
  event: K,
  fn: (...args: GameEventMap[K]) => void,
) => void;

export interface IGame {
  on: EventEmit;
  off: EventEmit;
  readonly snapshot: GameEventPayload;
  readonly gameStatus: GameStatus;
  readonly currentPlayer: PlayerSymbol;
  savePlayerSelection: (field: number) => void;
  reset: () => void;
  isFieldSelected: (field: number) => boolean;
  isFieldSelectedByIndex: (index: number) => boolean;
  savePlayerMove: (index: number) => PlayerMoveStatus;
  getBoard: () => (number | PlayerSymbol)[];
}
