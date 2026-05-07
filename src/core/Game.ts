import type { GameStatus, IGame } from "./types/Game";
import type { PlayerSymbol, PlayerSymbols } from "./types/Symbol";

import { Board } from "./Board";
import { DEFAULT_GAME_SYMBOLS } from "./constants";
import { getWinnerFromFields } from "./utils/getWinnerFromFields";

export class Game implements IGame {
  private _currentPlayer: PlayerSymbol = DEFAULT_GAME_SYMBOLS[0];
  private _gameStatus: GameStatus = { status: "running" };
  private _symbols: PlayerSymbols = DEFAULT_GAME_SYMBOLS;
  private _board = new Board();

  private _togglePlayer() {
    this._currentPlayer =
      this._currentPlayer === this._symbols[0]
        ? this._symbols[1]
        : this._symbols[0];
  }

  private _updateGameStatus() {
    const board = this._board;
    const winner = getWinnerFromFields(board.getFields());
    const isDraw = board.isFull() && !winner;

    if (winner) {
      this._gameStatus = { status: "win", winner };
      return;
    }

    if (isDraw) {
      this._gameStatus = { status: "draw" };
      return;
    }

    this._gameStatus = { status: "running" };
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
  getBoard() {
    return this._board.getFields();
  }

  /**
   * Checks if a field is already selected by a player.
   * @param field The field number to check.
   * @returns `true` if the field is selected, `false` otherwise.
   */
  isFieldSelected(field: number) {
    return typeof this._board.getFieldByNumber(field) === "string";
  }

  /**
   * Saves a player's selection on the board.
   * @param field The field number to mark.
   */
  savePlayerSelection(field: number) {
    this._board.setFieldByNumber(field, this._currentPlayer);
    this._togglePlayer();
    this._updateGameStatus();
  }

  /**
   * Resets the game to its initial state.
   */
  reset() {
    this._gameStatus = { status: "running" };
    this._currentPlayer = this._symbols[0];
    this._board.reset();
  }
}
