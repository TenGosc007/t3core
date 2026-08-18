import type { IGame } from "../game/types/Game.types";
import type { PlayerSymbol } from "../game/types/Symbol.types";
import type { AIDifficulty, AIMoveResult, AIOptions } from "./types";

import { GameEvent } from "../game/types/Game.types";
import { getBestMove } from "./getBestMove";
import { AIDifficulty as AIDifficultyValue } from "./types";

/**
 * Stateful AI player wrapper around {@link getBestMove}.
 *
 * Supports two usage modes:
 * - **Auto-play** via {@link attach}: subscribes to `GameEvent.STATE_CHANGE`
 *   and moves automatically when it is the AI's turn and the game is running.
 *   {@link detach} unsubscribes.
 * - **Manual** via {@link nextMove}: the caller decides when the AI moves
 *   (e.g. CLI prompts step by step). Returns {@link AIMoveResult} and applies
 *   the move through `game.savePlayerMove`.
 */
export class AIPlayer {
  private _difficulty: AIDifficulty;
  private _symbol: PlayerSymbol;
  private readonly _opponentSymbol?: PlayerSymbol;
  private readonly _seed?: number;

  private _attachedGame: IGame | null = null;
  private _listener: (() => void) | null = null;

  constructor(options: AIOptions = {}) {
    this._difficulty = options.difficulty ?? AIDifficultyValue.HARD;
    this._symbol = options.symbol ?? "X";
    this._opponentSymbol = options.opponentSymbol;
    this._seed = options.seed;
  }

  /** Current difficulty level. */
  get difficulty(): AIDifficulty {
    return this._difficulty;
  }

  /** Symbol the AI plays. */
  get symbol(): PlayerSymbol {
    return this._symbol;
  }

  /** Changes the difficulty level (takes effect on the next move). */
  setDifficulty(difficulty: AIDifficulty): void {
    this._difficulty = difficulty;
  }

  private _options(): AIOptions {
    return {
      difficulty: this._difficulty,
      symbol: this._symbol,
      opponentSymbol: this._opponentSymbol,
      seed: this._seed,
    };
  }

  private _maybeMove(game: IGame): void {
    if (game.gameStatus.status !== "running") return;
    if (game.currentPlayer !== this._symbol) return;

    const result = getBestMove(game, this._options());
    if (result.status === "success") {
      game.savePlayerMove(result.index);
    }
  }

  /**
   * Subscribes to `STATE_CHANGE` on `game` and auto-plays when it is the AI's
   * turn. If the AI is to move first (its turn already on attach), it moves
   * immediately. Call {@link detach} to unsubscribe.
   *
   * @throws {RangeError} When the game board is not 9 cells (propagated from
   *   {@link getBestMove}).
   */
  attach(game: IGame): void {
    if (this._attachedGame) {
      throw new Error("AIPlayer is already attached. Call detach() first.");
    }

    this._listener = () => this._maybeMove(game);
    game.on(GameEvent.STATE_CHANGE, this._listener);
    this._attachedGame = game;

    // If it's already the AI's turn, move immediately — no STATE_CHANGE will
    // fire until the opponent (a human or another AI) makes a move.
    this._maybeMove(game);
  }

  /** Unsubscribes from the game. Safe to call when not attached (no-op). */
  detach(): void {
    if (!this._attachedGame || !this._listener) return;

    this._attachedGame.off(GameEvent.STATE_CHANGE, this._listener);
    this._attachedGame = null;
    this._listener = null;
  }

  /**
   * Computes and applies the AI's move on `game` via `game.savePlayerMove`.
   * The caller controls timing — useful for CLI flows that want to pause
   * between moves or display the AI's "thinking" step.
   *
   * Does **not** require {@link attach} — can be used standalone.
   *
   * @returns {@link AIMoveResult}:
   *   - `{ status: "success", index }` — the move was applied.
   *   - `{ status: "no_moves" }` — the game is not running or the board is full.
   * @throws {RangeError} When the game board is not 9 cells (propagated from
   *   {@link getBestMove}).
   */
  nextMove(game: IGame): AIMoveResult {
    const result = getBestMove(game, this._options());
    if (result.status === "success") {
      game.savePlayerMove(result.index);
    }
    return result;
  }
}
