import type { SessionOperation } from "./BaseSession";
import type { GameSession, PlayMoveResult, StartResult } from "./types";
import type { MoveStrategy } from "@/ai";
import type { PlayerSymbol } from "@/game/contracts";
import type { Game } from "@/game/Game";

import { MoveStrategyError } from "@/ai";
import { PlayerMoveStatus } from "@/game/types/Game.types";

import { BaseSession } from "./BaseSession";
import { parsePlayerSymbol } from "./state/createSnapshot";
import { isLegalMove } from "./utils";

/** Applies human input and automatically calculates the AI reply. */
export class SinglePlayerGame extends BaseSession implements GameSession {
  private readonly _strategy: MoveStrategy;
  private readonly _humanSymbol: PlayerSymbol;
  private readonly _aiSymbol: PlayerSymbol;

  constructor(options: {
    game: Game;
    strategy: MoveStrategy;
    humanSymbol: string;
    aiSymbol: string;
  }) {
    const humanSymbol = parsePlayerSymbol(options.humanSymbol);
    const aiSymbol = parsePlayerSymbol(options.aiSymbol);
    if (humanSymbol === aiSymbol) throw new RangeError("Players must use different symbols.");
    super(options.game, { mode: "singleplayer", humanSymbol });
    this._strategy = options.strategy;
    this._humanSymbol = humanSymbol;
    this._aiSymbol = aiSymbol;
  }

  async start(): Promise<StartResult> {
    if (this._busyOperation !== null) return { status: "busy" };
    if (this._lifecycle === "started") {
      throw new Error("start() called twice without reset().");
    }
    const operation = this._beginOperation();
    try {
      if (this._game.gameStatus.status !== "running") {
        this._lifecycle = "finished";
        return { status: this._publish(operation, "finished", true) ? "success" : "aborted" };
      }
      this._lifecycle = "started";
      if (this._game.currentPlayer === this._humanSymbol) {
        if (!this._publish(operation, "human-turn", true)) return { status: "aborted" };
        this._emit("turn", { player: this._humanSymbol });
        return { status: this._isCurrent(operation) ? "success" : "aborted" };
      }
      return { status: await this._runAiMove(operation) };
    } finally {
      this._endOperation(operation);
    }
  }

  async playMove(index: number): Promise<PlayMoveResult> {
    if (this._busyOperation !== null) return { status: "busy" };
    if (this._lifecycle !== "started" || this._game.currentPlayer !== this._humanSymbol) {
      return { status: "game_not_running" };
    }
    const operation = this._beginOperation();
    try {
      const status = this._game.savePlayerMove(index);
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (status !== PlayerMoveStatus.SUCCESS) return { status };
      const finished = this._game.gameStatus.status !== "running";
      if (finished) this._lifecycle = "finished";
      if (!this._publish(operation, finished ? "finished" : "ai-thinking", finished)) {
        return { status: "aborted" };
      }
      this._emit("move", { player: this._humanSymbol, position: index });
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (finished) {
        this._emit("finished", { result: this._game.gameStatus });
        return { status: this._isCurrent(operation) ? "success" : "aborted" };
      }
      return { status: await this._runAiMove(operation) };
    } finally {
      this._endOperation(operation);
    }
  }

  private async _runAiMove(operation: SessionOperation): Promise<"success" | "aborted"> {
    if (!this._publish(operation, "ai-thinking")) return "aborted";
    this._emit("ai-thinking", { player: this._aiSymbol });
    if (!this._isCurrent(operation)) return "aborted";

    let move: number;
    try {
      move = await this._strategy.calculateMove(this._game.board, {
        aiSymbol: this._aiSymbol,
        opponentSymbol: this._humanSymbol,
        gameStatus: this._game.gameStatus,
      });
      // Stale work must be ignored before its result is validated.
      if (!this._isCurrent(operation)) return "aborted";
      if (!isLegalMove(move, this._game.board)) {
        throw new MoveStrategyError("illegal_move", `Strategy returned illegal index: ${move}`);
      }
    } catch (error) {
      if (!this._isCurrent(operation)) return "aborted";
      this._failAI(operation, error);
      if (!this._isCurrent(operation)) return "aborted";
      throw error;
    }

    this._game.savePlayerMove(move);
    if (!this._isCurrent(operation)) return "aborted";
    const finished = this._game.gameStatus.status !== "running";
    if (finished) this._lifecycle = "finished";
    if (!this._publish(operation, finished ? "finished" : "human-turn", true)) return "aborted";
    this._emit("move", { player: this._aiSymbol, position: move });
    if (!this._isCurrent(operation)) return "aborted";
    if (finished) this._emit("finished", { result: this._game.gameStatus });
    else this._emit("turn", { player: this._humanSymbol });
    return this._isCurrent(operation) ? "success" : "aborted";
  }
}
