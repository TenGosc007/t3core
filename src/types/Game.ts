import type { BoardSnapshot } from "./Board";
import type { PlayerSymbol } from "./Symbol";

type GameStatusWin = { status: "win"; winner: PlayerSymbol };
type GameStatusDraw = { status: "draw" };
type GameStatusRunning = { status: "running" };

export type GameStatus = GameStatusWin | GameStatusDraw | GameStatusRunning;

export const GameVariant = {
  CLASSIC_3X3: "classic-3x3",
} as const;
export type GameVariant = (typeof GameVariant)[keyof typeof GameVariant];

export type GameOptions = {
  /**
   * Predefined game variant. Currently only the classic 3x3 board is supported.
   */
  variant?: GameVariant;
  /**
   * @deprecated Use `variant` instead. The game supports predefined variants,
   * not arbitrary board sizes. Only `9` is valid for the current classic 3x3 variant.
   */
  boardSize?: number;
};

export const PlayerMoveStatus = {
  SUCCESS: "success",
  ALREADY_SELECTED: "already_selected",
  GAME_NOT_RUNNING: "game_not_running",
  INVALID_INDEX: "invalid_index",
} as const;
export type PlayerMoveStatus =
  (typeof PlayerMoveStatus)[keyof typeof PlayerMoveStatus];

export const BackToMoveStatus = {
  SUCCESS: "success",
  INVALID_HISTORY_INDEX: "invalid_history_index",
} as const;
export type BackToMoveStatus =
  (typeof BackToMoveStatus)[keyof typeof BackToMoveStatus];

export const GameEvent = {
  /** @deprecated Use `STATE_CHANGE` instead. Still emitted by `savePlayerMove` with `index` in payload. */
  PLAYER_MOVE: "PLAYER_MOVE",
  /** @deprecated Use `STATE_CHANGE` instead. Still emitted by `reset()`. */
  RESET: "RESET",
  STATE_CHANGE: "STATE_CHANGE",
} as const;
export type GameEvent = (typeof GameEvent)[keyof typeof GameEvent];

export type GameEventPayload = {
  board: BoardSnapshot;
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
  readonly board: BoardSnapshot;
  readonly movesCount: number;
  /** @deprecated Use `savePlayerMove` instead. */
  savePlayerSelection: (field: number) => void;
  reset: () => void;
  /** @deprecated Use `isFieldSelectedByIndex` instead. */
  isFieldSelected: (field: number) => boolean;
  isFieldSelectedByIndex: (index: number) => boolean;
  savePlayerMove: (index: number) => PlayerMoveStatus;
  /** @deprecated Use `board` instead. */
  getBoard: () => BoardSnapshot;
  backToMove: (index: number) => BackToMoveStatus;
}
