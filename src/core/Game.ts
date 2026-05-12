import type { PlayerSymbol, PlayerSymbols } from "./types/Symbol";

import EventEmitter from "eventemitter3";

import { Board } from "./Board";
import { DEFAULT_GAME_SYMBOLS } from "./constants";
import {
  GameEvent,
  PlayerMoveStatus,
  type GameEventMap,
  type GameEventPayload,
  type GameStatus,
  type IGame,
} from "./types/Game";
import { getWinnerFromFields } from "./utils/getWinnerFromFields";

export class Game implements IGame {
  private _currentPlayer: PlayerSymbol = DEFAULT_GAME_SYMBOLS[0];
  private _gameStatus: GameStatus = { status: "running" };
  private _symbols: PlayerSymbols = DEFAULT_GAME_SYMBOLS;
  private _board = new Board();
  private _emitter = new EventEmitter<GameEventMap>();
  private _snapshot: GameEventPayload = {
    board: this._board.fields,
    currentPlayer: this._currentPlayer,
    gameStatus: this._gameStatus,
  };

  private _togglePlayer() {
    this._currentPlayer =
      this._currentPlayer === this._symbols[0]
        ? this._symbols[1]
        : this._symbols[0];
  }

  private _updateGameStatus() {
    const board = this._board;
    const winner = getWinnerFromFields(board.fields);
    const isDraw = board.isFull() && !winner;
    const isNotRunning = this._gameStatus.status !== "running";

    if (winner) {
      this._gameStatus = { status: "win", winner };
      return;
    }

    if (isDraw) {
      this._gameStatus = { status: "draw" };
      return;
    }

    if (isNotRunning) {
      this._gameStatus = { status: "running" };
    }
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
   * @type {(number | PlayerSymbol)[]}
   */
  get board() {
    return this._board.fields;
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
   * @type {(number | PlayerSymbol)[]}
   * @deprecated Use `board` instead.
   */
  getBoard() {
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
   * @param field The field number to mark.
   * @deprecated Use `savePlayerMove` instead.
   */
  savePlayerSelection(field: number) {
    this._board.setFieldByNumber(field, this._currentPlayer);
    this._togglePlayer();
    this._updateGameStatus();
  }

  /**
   * Saves a player's selection on the board by index.
   * emit PLAYER_MOVE event
   * @param index The index of the field to mark.
   */
  savePlayerMove(index: number) {
    if (this.isFieldSelected(index + 1)) {
      console.warn("Field is already selected");
      return PlayerMoveStatus.ALREADY_SELECTED;
    }

    if (this._gameStatus.status !== "running") {
      console.warn("Game is not running");
      return PlayerMoveStatus.GAME_NOT_RUNNING;
    }

    this._board.setFieldByIndex(index, this._currentPlayer);
    this._togglePlayer();
    this._updateGameStatus();
    this._snapshot = {
      board: this._board.fields,
      currentPlayer: this._currentPlayer,
      gameStatus: this._gameStatus,
    };
    this._emitter.emit(GameEvent.PLAYER_MOVE, {
      index,
      ...this._snapshot,
    });

    return PlayerMoveStatus.SUCCESS;
  }

  /**
   * Resets the game to its initial state.
   * emit RESET event
   */
  reset() {
    this._gameStatus = { status: "running" };
    this._currentPlayer = this._symbols[0];
    this._board.reset();
    this._snapshot = {
      board: this._board.fields,
      currentPlayer: this._currentPlayer,
      gameStatus: this._gameStatus,
    };
    this._emitter.emit(GameEvent.RESET, this._snapshot);
  }
}
