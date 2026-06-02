import type { BoardField } from "./Board";
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
  /** @deprecated Use `STATE_CHANGE` instead. */
  PLAYER_MOVE: "PLAYER_MOVE",
  /** @deprecated Use `STATE_CHANGE` instead. */
  RESET: "RESET",
  STATE_CHANGE: "STATE_CHANGE",
} as const;
export type GameEvent = (typeof GameEvent)[keyof typeof GameEvent];

export type GameEventPayload = {
  board: BoardField[];
  currentPlayer: PlayerSymbol;
  gameStatus: GameStatus;
};

export type GameEventMap = {
  /** @deprecated Use `STATE_CHANGE` instead. */
  [GameEvent.PLAYER_MOVE]: [payload: GameEventPayload & { index: number }];
  /** @deprecated Use `STATE_CHANGE` instead. */
  [GameEvent.RESET]: [payload?: GameEventPayload];
  [GameEvent.STATE_CHANGE]: [payload: GameEventPayload];
};

export type EventEmit<T> = <K extends keyof GameEventMap>(
  event: K,
  fn: (...args: GameEventMap[K]) => void,
) => T;

export interface IGame {
  on: EventEmit<this>;
  off: EventEmit<this>;
  readonly snapshot: GameEventPayload;
  readonly gameStatus: GameStatus;
  readonly currentPlayer: PlayerSymbol;
  readonly board: BoardField[];
  readonly movesCount: number;
  /** @deprecated Use `savePlayerMove` instead. */
  savePlayerSelection: (field: number) => void;
  reset: () => void;
  /** @deprecated Use `isFieldSelectedByIndex` instead. */
  isFieldSelected: (field: number) => boolean;
  isFieldSelectedByIndex: (index: number) => boolean;
  savePlayerMove: (index: number) => PlayerMoveStatus;
  /** @deprecated Use `board` instead. */
  getBoard: () => BoardField[];
  backToMove: (index: number) => void;
}
