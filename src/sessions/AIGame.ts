import type { SessionOperation } from "./BaseSession";
import type { PlayMoveResult, RunResult } from "./types";
import type { MoveStrategy } from "@/ai";
import type { Game } from "@/game/Game";
import type { GameEventPayload } from "@/game/types/Game.types";

import { MoveStrategyError } from "@/ai";

import { BaseSession } from "./BaseSession";
import { parsePlayerSymbol } from "./state/createSnapshot";
import { isLegalMove } from "./utils";

/** AI-vs-AI orchestration with individual steps or continuous play. */
export class AIGame extends BaseSession {
  private readonly _strategies: readonly [MoveStrategy, MoveStrategy];

  constructor(options: { game: Game; strategies: [MoveStrategy, MoveStrategy] }) {
    super(options.game, { mode: "aivsai", humanSymbol: null });
    this._strategies = options.strategies;
  }

  async step(): Promise<PlayMoveResult> {
    if (this._busyOperation !== null) return { status: "busy" };
    if (this._game.gameStatus.status !== "running") return { status: "game_not_running" };
    const operation = this._beginOperation();
    try {
      return await this._performStep(operation, false);
    } finally {
      this._endOperation(operation);
    }
  }

  async run(): Promise<RunResult> {
    if (this._busyOperation !== null) return { status: "busy" };
    if (this._game.gameStatus.status !== "running") {
      return { status: "completed", result: this._game.gameStatus };
    }
    const operation = this._beginOperation();
    try {
      while (this._game.gameStatus.status === "running") {
        const result = await this._performStep(operation, true);
        if (!this._isCurrent(operation) || result.status === "aborted") return { status: "aborted" };
      }
      return { status: "completed", result: this._game.gameStatus };
    } finally {
      this._endOperation(operation);
    }
  }

  private async _performStep(operation: SessionOperation, continuous: boolean): Promise<PlayMoveResult> {
    this._lifecycle = "started";
    const player = parsePlayerSymbol(this._game.currentPlayer);
    const strategy = this._strategies[player === "O" ? 0 : 1];
    const opponent = player === "O" ? "X" : "O";

    if (!this._publish(operation, "ai-thinking")) return { status: "aborted" };
    this._emit("ai-thinking", { player });
    if (!this._isCurrent(operation)) return { status: "aborted" };

    let move: number;
    try {
      move = await strategy.calculateMove(this._game.board, {
        aiSymbol: player,
        opponentSymbol: opponent,
        gameStatus: this._game.gameStatus,
      });
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (!isLegalMove(move, this._game.board)) {
        throw new MoveStrategyError("illegal_move", `Strategy returned illegal index: ${move}`);
      }
    } catch (error) {
      if (!this._isCurrent(operation)) return { status: "aborted" };
      this._failAI(operation, error);
      if (!this._isCurrent(operation)) return { status: "aborted" };
      throw error;
    }

    this._game.savePlayerMove(move);
    if (!this._isCurrent(operation)) return { status: "aborted" };
    const finished = this._game.gameStatus.status !== "running";
    if (finished) this._lifecycle = "finished";
    const phase = finished ? "finished" : continuous ? "ai-thinking" : "ai-ready";
    if (!this._publish(operation, phase, finished || !continuous)) return { status: "aborted" };
    this._emit("move", { player, position: move });
    if (!this._isCurrent(operation)) return { status: "aborted" };
    if (finished) this._emit("finished", { result: this._game.gameStatus });
    else this._emit("turn", { player: this._game.currentPlayer });
    return { status: this._isCurrent(operation) ? "success" : "aborted" };
  }
}

export type { GameEventPayload };
