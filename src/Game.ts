import type { BoardField } from "./types/Board";
import type { PlayerSymbol, PlayerSymbols } from "./types/Symbol";

import EventEmitter from "eventemitter3";

import { Board } from "./Board";
import { DEFAULT_GAME_SYMBOLS } from "./constants";
import {
  BackToMoveStatus,
  GameEvent,
  GameVariant,
  PlayerMoveStatus,
  type GameEventMap,
  type GameEventPayload,
  type GameStatus,
  type IGame,
} from "./types/Game";
import { getWinnerFromFields } from "./utils/getWinnerFromFields";

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

type GameVariantConfig = {
  boardSize: number;
};

const GAME_VARIANT_CONFIGS = {
  [GameVariant.CLASSIC_3X3]: {
    boardSize: 9,
  },
} as const satisfies Record<GameVariant, GameVariantConfig>;

const resolveGameVariantConfig = (
  options: GameOptions,
): GameVariantConfig => {
  const variant = options.variant ?? GameVariant.CLASSIC_3X3;
  const config = GAME_VARIANT_CONFIGS[variant];

  if (options.boardSize !== undefined && options.boardSize !== config.boardSize) {
    throw new RangeError(
      "`boardSize` is deprecated and arbitrary board sizes are not supported. Use a predefined `variant` instead.",
    );
  }

  return config;
};

export class Game implements IGame {
  private _currentPlayer: PlayerSymbol = DEFAULT_GAME_SYMBOLS[0];
  private _gameStatus: GameStatus = { status: "running" };
  private _symbols: PlayerSymbols = DEFAULT_GAME_SYMBOLS;
  private _board: Board;

  private _emitter = new EventEmitter<GameEventMap>();
  private _snapshot: GameEventPayload;

  constructor(options: GameOptions = {}) {
    const config = resolveGameVariantConfig(options);
    this._board = new Board(config.boardSize);
    this._snapshot = {
      board: this._board.fields,
      currentPlayer: this._currentPlayer,
      gameStatus: this._gameStatus,
    };
  }

  private _togglePlayer() {
    this._currentPlayer =
      this._currentPlayer === this._symbols[0]
        ? this._symbols[1]
        : this._symbols[0];
  }

  private _isBoardIndexValid(index: number) {
    return Number.isInteger(index) && index >= 0 && index < this._board.fields.length;
  }

  private _isHistoryIndexValid(index: number) {
    return (
      Number.isInteger(index) &&
      index >= 0 &&
      index <= this._board.snapshotCount
    );
  }

  private _updateGameStatus() {
    const board = this._board;
    const winner = getWinnerFromFields(board.fields);

    if (winner) {
      this._gameStatus = { status: "win", winner };
      return;
    }

    if (board.isFull()) {
      this._gameStatus = { status: "draw" };
      return;
    }

    // Preserve the existing reference if the game is already running to avoid
    // unnecessary object allocations and maintain referential stability.
    if (this._gameStatus.status !== "running") {
      this._gameStatus = { status: "running" };
    }
  }

  _updateGameState(index?: number) {
    this._updateGameStatus();
    this._snapshot = {
      board: this._board.fields,
      currentPlayer: this._currentPlayer,
      gameStatus: this._gameStatus,
    };
    if (index !== undefined) {
      this._emitter.emit(GameEvent.PLAYER_MOVE, { ...this._snapshot, index });
    }
    this._emitter.emit(GameEvent.STATE_CHANGE, this._snapshot);
  }

  /**
   * Returns a stable snapshot of the current game state.
   * The same object reference is returned between moves, making it safe
   * as a `getSnapshot` argument for `useSyncExternalStore`.
   */
  get snapshot(): GameEventPayload {
    return this._snapshot;
  }

  /**
   * Returns the current player.
   * @returns The current player.
   */
  get currentPlayer(): PlayerSymbol {
    return this._currentPlayer;
  }

  /**
   * Returns the current game status.
   * @returns The current game status.
   * @type {GameStatus<PlayerSymbol>}
   */
  get gameStatus(): GameStatus {
    return this._gameStatus;
  }

  /**
   * Returns the current board state.
   * @returns The current board state.
   * @type {BoardField[]}
   */
  get board() {
    return this._board.fields;
  }

  /**
   * Returns the number of moves made in the current game.
   * @returns The number of moves made.
   */
  get movesCount() {
    return this._board.snapshotCount;
  }

  /**
   * Registers an event listener for the specified event.
   * @param event The event to listen for.
   * @param fn The function to call when the event is emitted.
   * @returns This Game instance for method chaining.
   */
  on<K extends keyof GameEventMap>(
    event: K,
    fn: (...args: GameEventMap[K]) => void,
  ): this {
    this._emitter.on(event, fn);
    return this;
  }

  /**
   * Removes an event listener for the specified event.
   * @param event The event to remove the listener from.
   * @param fn The function to remove.
   * @returns This Game instance for method chaining.
   */
  off<K extends keyof GameEventMap>(
    event: K,
    fn: (...args: GameEventMap[K]) => void,
  ): this {
    this._emitter.off(event, fn);
    return this;
  }

  /**
   * Returns the current board state.
   * @returns The current board state.
   * @type {BoardField[]}
   * @deprecated Use `board` instead.
   */
  getBoard(): BoardField[] {
    return this._board.fields;
  }

  /**
   * Checks if a field is already selected by a player.
   * @param field The field number to check.
   * @returns `true` if the field is selected, `false` otherwise.
   * @deprecated Use `isFieldSelectedByIndex` instead.
   */
  isFieldSelected(field: number) {
    return typeof this._board.getFieldByNumber(field) === "string";
  }

  /**
   * Checks if a field is already selected by a player.
   * @param index The index of the field to check.
   * @returns `true` if the field is selected, `false` otherwise.
   */
  isFieldSelectedByIndex(index: number) {
    return typeof this._board.getFieldByIndex(index) === "string";
  }

  /**
   * Saves a player's selection on the board.
   * @param field The field number to mark (1-9 numbering).
   * @deprecated Use `savePlayerMove(index)` instead (0-8 index-based). Does not emit events or update the snapshot.
   */
  savePlayerSelection(field: number) {
    this._board.setFieldByNumber(field, this._currentPlayer);
    this._togglePlayer();
    this._updateGameStatus();
  }

  /**
   * Saves a player's selection on the board by index.
   * Emits {@link GameEvent.STATE_CHANGE} event.
   * Also emits {@link GameEvent.PLAYER_MOVE} event (deprecated).
   * @param index The index of the field to mark.
   */
  savePlayerMove(index: number): PlayerMoveStatus {
    if (!this._isBoardIndexValid(index)) {
      return PlayerMoveStatus.INVALID_INDEX;
    }

    if (this.isFieldSelectedByIndex(index)) {
      return PlayerMoveStatus.ALREADY_SELECTED;
    }

    if (this._gameStatus.status !== "running") {
      return PlayerMoveStatus.GAME_NOT_RUNNING;
    }

    this._board.setFieldByIndex(index, this._currentPlayer);
    this._togglePlayer();
    this._updateGameState(index);

    return PlayerMoveStatus.SUCCESS;
  }

  /**
   * Restores the game to a previous state by index.
   * @param index The index of the state to restore.
   */
  backToMove(index: number): BackToMoveStatus {
    if (!this._isHistoryIndexValid(index)) {
      return BackToMoveStatus.INVALID_HISTORY_INDEX;
    }

    const board = this._board;
    board.restoreBoardHistoryAt(index);
    this._currentPlayer = this._symbols[index % 2];
    this._updateGameState();

    return BackToMoveStatus.SUCCESS;
  }

  /**
   * Resets the game to its initial state.
   * Emits {@link GameEvent.STATE_CHANGE} event.
   * Also emits {@link GameEvent.RESET} event (deprecated).
   */
  reset() {
    this._currentPlayer = this._symbols[0];
    this._board.reset();
    this._updateGameState();
    this._emitter.emit(GameEvent.RESET, this._snapshot);
  }
}
