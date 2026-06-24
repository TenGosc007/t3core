import type { GameStrategy } from "../strategies";
import type { BoardSnapshot } from "./types/Board.types";
import type { PlayerSymbol, PlayerSymbols } from "./types/Symbol.types";

import EventEmitter from "eventemitter3";

import { DEFAULT_GAME_SYMBOLS } from "../constants/gameConstants";
import { resolveGameStrategy } from "../strategies";
import { Board } from "./Board";
import {
  BackToMoveStatus,
  GameEvent,
  PlayerMoveStatus,
  type GameEventMap,
  type GameEventPayload,
  type GameOptions,
  type GameStatus,
  type IGame,
} from "./types/Game.types";

/**
 * Main public facade for a Tic Tac Toe game.
 *
 * Manages the board, current player, win/draw detection, move history, and
 * emits typed events that can be consumed by UI frameworks such as React via
 * `useSyncExternalStore`.
 */
export class Game implements IGame {
  private _currentPlayer: PlayerSymbol = DEFAULT_GAME_SYMBOLS[0];
  private _gameStatus: GameStatus = { status: "running" };
  private _symbols: PlayerSymbols = DEFAULT_GAME_SYMBOLS;
  private _board: Board;
  private _strategy: GameStrategy;

  private _emitter = new EventEmitter<GameEventMap>();
  private _snapshot: GameEventPayload;

  /**
   * Creates a new game instance.
   *
   * @param options - Optional configuration. Use `variant` to select a predefined
   *   game variant. `boardSize` is deprecated and only accepted for backwards compatibility.
   */
  constructor(options: GameOptions = {}) {
    this._strategy = resolveGameStrategy(options);
    this._board = new Board(this._strategy.boardSize);
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
    return (
      Number.isInteger(index) && index >= 0 && index < this._board.fields.length
    );
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
    const winner = this._strategy.getWinner(board.fields);

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
   * @type {BoardSnapshot}
   */
  get board(): BoardSnapshot {
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
   * @type {BoardSnapshot}
   * @deprecated Use `board` instead. Will be removed in v2.0.
   */
  getBoard(): BoardSnapshot {
    return this._board.fields;
  }

  /**
   * Checks if a field is already selected by a player.
   * @param field The 1-based field number to check.
   * @returns `true` if the field is selected, `false` otherwise.
   * @deprecated Use `isFieldSelectedByIndex` instead. Will be removed in v2.0.
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
   * @param field The 1-based field number to mark (1-9 numbering).
   * @deprecated Use `savePlayerMove(index)` instead (0-8 index-based). Does not emit events or update the snapshot.
   *   Will be removed in v2.0.
   */
  savePlayerSelection(field: number) {
    this._board.setFieldByNumber(field, this._currentPlayer);
    this._togglePlayer();
    this._updateGameStatus();
  }

  /**
   * Saves a player's selection on the board by 0-based index.
   *
   * Emits {@link GameEvent.STATE_CHANGE}. For backwards compatibility it also
   * emits the deprecated {@link GameEvent.PLAYER_MOVE}, which will be removed in v2.0.
   *
   * @param index The 0-based index of the field to mark.
   * @returns The status of the move.
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
   *
   * Emits {@link GameEvent.STATE_CHANGE}. For backwards compatibility it also
   * emits the deprecated {@link GameEvent.RESET}, which will be removed in v2.0.
   */
  reset() {
    this._currentPlayer = this._symbols[0];
    this._board.reset();
    this._updateGameState();
    this._emitter.emit(GameEvent.RESET, this._snapshot);
  }
}
