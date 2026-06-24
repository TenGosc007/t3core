import type { BoardSnapshot } from "./Board.types";
import type { PlayerSymbol } from "./Symbol.types";

type GameStatusWin = { status: "win"; winner: PlayerSymbol };
type GameStatusDraw = { status: "draw" };
type GameStatusRunning = { status: "running" };

/** Union of all possible game states. */
export type GameStatus = GameStatusWin | GameStatusDraw | GameStatusRunning;

/** Predefined game variants. New variants are added here as the library grows. */
export const GameVariant = {
  CLASSIC_3X3: "classic-3x3",
} as const;
export type GameVariant = (typeof GameVariant)[keyof typeof GameVariant];

/** Options for creating a new `Game` instance. */
export type GameOptions = {
  /**
   * Predefined game variant. Currently only the classic 3x3 board is supported.
   */
  variant?: GameVariant;

  /**
   * @deprecated Use `variant` instead. The game supports predefined variants,
   * not arbitrary board sizes. Only `9` is valid for the current classic 3x3 variant.
   * Will be removed in v2.0.
   */
  boardSize?: number;
};

/** Status returned by `Game.savePlayerMove`. */
export const PlayerMoveStatus = {
  SUCCESS: "success",
  ALREADY_SELECTED: "already_selected",
  GAME_NOT_RUNNING: "game_not_running",
  INVALID_INDEX: "invalid_index",
} as const;
export type PlayerMoveStatus =
  (typeof PlayerMoveStatus)[keyof typeof PlayerMoveStatus];

/** Status returned by `Game.backToMove`. */
export const BackToMoveStatus = {
  SUCCESS: "success",
  INVALID_HISTORY_INDEX: "invalid_history_index",
} as const;
export type BackToMoveStatus =
  (typeof BackToMoveStatus)[keyof typeof BackToMoveStatus];

/** Game events emitted by the `Game` instance. */
export const GameEvent = {
  /**
   * @deprecated Use `STATE_CHANGE` instead. Still emitted by `savePlayerMove` with `index` in payload.
   * Will be removed in v2.0.
   */
  PLAYER_MOVE: "PLAYER_MOVE",

  /**
   * @deprecated Use `STATE_CHANGE` instead. Still emitted by `reset()`.
   * Will be removed in v2.0.
   */
  RESET: "RESET",

  /** Emitted after every state-changing action: `savePlayerMove`, `backToMove`, and `reset`. */
  STATE_CHANGE: "STATE_CHANGE",
} as const;
export type GameEvent = (typeof GameEvent)[keyof typeof GameEvent];

/** Stable snapshot of the game state, returned by `Game.snapshot` and event payloads. */
export type GameEventPayload = {
  board: BoardSnapshot;
  currentPlayer: PlayerSymbol;
  gameStatus: GameStatus;
};

/** Typed event map for `eventemitter3` listeners. */
export type GameEventMap = {
  /**
   * @deprecated Use `STATE_CHANGE` instead. Will be removed in v2.0.
   */
  [GameEvent.PLAYER_MOVE]: [payload: GameEventPayload & { index: number }];

  /**
   * @deprecated Use `STATE_CHANGE` instead. Will be removed in v2.0.
   */
  [GameEvent.RESET]: [payload?: GameEventPayload];

  /** Emitted after every state-changing action. */
  [GameEvent.STATE_CHANGE]: [payload: GameEventPayload];
};

/** Internal helper type for event listener registration. */
export type EventEmit<T> = <K extends keyof GameEventMap>(
  event: K,
  fn: (...args: GameEventMap[K]) => void,
) => T;

/** Public contract for the `Game` class. */
export interface IGame {
  on: EventEmit<this>;
  off: EventEmit<this>;

  /** Stable snapshot for external stores (e.g. `useSyncExternalStore`). */
  readonly snapshot: GameEventPayload;

  /** Current game status. */
  readonly gameStatus: GameStatus;

  /** Symbol of the player whose turn it is. */
  readonly currentPlayer: PlayerSymbol;

  /** Current board state as a read-only snapshot. */
  readonly board: BoardSnapshot;

  /** Number of moves made in the current game. */
  readonly movesCount: number;

  /**
   * @deprecated Use `savePlayerMove` instead. Will be removed in v2.0.
   */
  savePlayerSelection: (field: number) => void;

  /** Resets the game to its initial state. */
  reset: () => void;

  /**
   * @deprecated Use `isFieldSelectedByIndex` instead. Will be removed in v2.0.
   */
  isFieldSelected: (field: number) => boolean;

  /** Checks whether the field at the given 0-based index is already occupied. */
  isFieldSelectedByIndex: (index: number) => boolean;

  /** Places the current player's symbol at the given 0-based index. */
  savePlayerMove: (index: number) => PlayerMoveStatus;

  /**
   * @deprecated Use `board` instead. Will be removed in v2.0.
   */
  getBoard: () => BoardSnapshot;

  /** Restores the game to a previous state at the given history index. */
  backToMove: (index: number) => BackToMoveStatus;
}
