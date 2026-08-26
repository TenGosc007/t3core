import type { GameSession, PlayMoveResult, StartResult } from "./types";
import type { MoveStrategy } from "@/ai";
import type { Game } from "@/game/Game";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

import { MoveStrategyError } from "@/ai";
import { PlayerMoveStatus } from "@/game/types/Game.types";

import { BaseSession } from "./BaseSession";
import { isLegalMove } from "./utils";

/**
 * Human-vs-AI session. `playMove(index)` applies the human's move, then
 * automatically triggers the AI's reply. One `await playMove` = one full
 * turn (human + AI). Eventy (`move`, `ai-thinking`, `turn`, `finished`) are
 * emitted during `playMove` so the UI can react to intermediate state.
 */
export class SinglePlayerGame extends BaseSession implements GameSession {
  private readonly _strategy: MoveStrategy;
  private readonly _humanSymbol: PlayerSymbol;
  private readonly _aiSymbol: PlayerSymbol;

  constructor(options: {
    game: Game;
    strategy: MoveStrategy;
    humanSymbol: PlayerSymbol;
    aiSymbol: PlayerSymbol;
  }) {
    super(options.game);
    this._strategy = options.strategy;
    this._humanSymbol = options.humanSymbol;
    this._aiSymbol = options.aiSymbol;
  }

  async start(): Promise<StartResult> {
    if (this._busyGeneration !== null) return { status: "busy" };
    if (this._lifecycle === "started") {
      throw new Error("start() called twice without reset().");
    }
    const gen = this._generation;
    this._busyGeneration = gen;
    try {
      this._lifecycle = "started";

      // If the human starts, simply emit `turn` for the human.
      if (this._game.currentPlayer === this._humanSymbol) {
        this._emit("turn", { player: this._humanSymbol });
        if (this._generation !== gen) return { status: "aborted" };
        return { status: "success" };
      }

      // AI starts — run the AI's first move.
      const result = await this._runAiMove(gen);
      return result === "aborted"
        ? { status: "aborted" }
        : { status: "success" };
    } finally {
      if (this._busyGeneration === gen) this._busyGeneration = null;
    }
  }

  async playMove(index: number): Promise<PlayMoveResult> {
    if (this._busyGeneration !== null) return { status: "busy" };
    if (this._lifecycle !== "started") return { status: "game_not_running" };

    const gen = this._generation;
    this._busyGeneration = gen;
    try {
      if (this._game.currentPlayer !== this._humanSymbol) {
        return { status: "game_not_running" };
      }

      const status = this._game.savePlayerMove(index);
      if (status === PlayerMoveStatus.INVALID_INDEX) {
        return { status: "invalid_index" };
      }
      if (status === PlayerMoveStatus.ALREADY_SELECTED) {
        return { status: "already_selected" };
      }
      if (status === PlayerMoveStatus.GAME_NOT_RUNNING) {
        return { status: "game_not_running" };
      }

      this._emit("move", { player: this._humanSymbol, position: index });

      if (this._game.gameStatus.status !== "running") {
        this._lifecycle = "finished";
        this._emit("finished", { result: this._game.gameStatus });
        return { status: "success" };
      }

      const aiResult = await this._runAiMove(gen);
      if (aiResult === "aborted") return { status: "aborted" };
      return { status: "success" };
    } finally {
      if (this._busyGeneration === gen) this._busyGeneration = null;
    }
  }

  /**
   * Performs the AI's move: emits `ai-thinking`, awaits the strategy, validates
   * the result, applies the move, emits `move` + (`turn` | `finished`).
   * Returns `'aborted'` if `reset()` was called during the await.
   */
  private async _runAiMove(gen: number): Promise<"success" | "aborted"> {
    this._emit("ai-thinking", { player: this._aiSymbol });

    let aiMove: number;
    try {
      aiMove = await this._strategy.calculateMove(this._game.board, {
        aiSymbol: this._aiSymbol,
        opponentSymbol: this._humanSymbol,
        gameStatus: this._game.gameStatus,
      });
    } catch (e) {
      // Reset takes priority even when the strategy rejects.
      if (this._generation !== gen) return "aborted";
      if (e instanceof MoveStrategyError && e.code === "no_legal_moves") {
        // The session checked the game was running before invoking the
        // strategy, so no_legal_moves in a running state means the board is
        // full — treat as a draw finish.
        this._lifecycle = "finished";
        this._emit("finished", { result: this._game.gameStatus });
        return "success";
      }
      throw e;
    }

    // Generation FIRST, then result validation — a stale result after reset
    // must be reported as `aborted`, not `illegal_move`.
    if (this._generation !== gen) return "aborted";

    if (!isLegalMove(aiMove, this._game.board)) {
      throw new MoveStrategyError(
        "illegal_move",
        `Strategy returned illegal index: ${aiMove}`,
      );
    }

    this._game.savePlayerMove(aiMove);
    this._emit("move", { player: this._aiSymbol, position: aiMove });

    if (this._game.gameStatus.status !== "running") {
      this._lifecycle = "finished";
      this._emit("finished", { result: this._game.gameStatus });
      return "success";
    }

    this._emit("turn", { player: this._humanSymbol });
    return "success";
  }
}
