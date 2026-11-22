import type { SessionOperation } from "./BaseSession";
import type { OperationResult, RunResult, StepResult } from "./results";
import type { MoveStrategy } from "@/ai";
import type { Game } from "@/game/Game";

import { BaseSession } from "./BaseSession";
import { parsePlayerSymbol } from "./state/createSnapshot";

/** AI-vs-AI orchestration with individual steps or continuous play. */
export class AIGame extends BaseSession {
  private readonly _strategies: readonly [MoveStrategy, MoveStrategy];

  constructor(options: { game: Game; strategies: [MoveStrategy, MoveStrategy] }) {
    super(options.game, { mode: "aivsai", humanSymbol: null }, options.strategies);
    this._strategies = options.strategies;
  }

  async step(): Promise<StepResult> {
    if (this._delivering && !(await this._afterDelivery())) return { status: "aborted" };
    const refusal = this._availability();
    if (refusal) return { status: "rejected", reason: refusal };
    if (this._game.gameStatus.status !== "running") return { status: "rejected", reason: "game_finished" };
    const operation = this._beginOperation();
    try {
      const result = await this._performStep(operation, false);
      return this._isCurrent(operation) ? result : { status: "aborted" };
    } finally {
      this._endOperation(operation);
    }
  }

  async run(): Promise<RunResult> {
    if (this._delivering && !(await this._afterDelivery())) return { status: "aborted" };
    const refusal = this._availability();
    if (refusal) return { status: "rejected", reason: refusal };
    if (this.snapshot.gameStatus.status !== "running") {
      return { status: "success", value: this.snapshot.gameStatus };
    }
    const operation = this._beginOperation();
    try {
      while (this._game.gameStatus.status === "running") {
        const result = await this._performStep(operation, true);
        if (!this._isCurrent(operation)) return { status: "aborted" };
        if (result.status !== "success") return result;
      }
      const result = this.getSnapshot().gameStatus;
      if (result.status === "running") throw new Error("AI run ended without a terminal result.");
      return { status: "success", value: result };
    } finally {
      this._endOperation(operation);
    }
  }

  private async _performStep(operation: SessionOperation, continuous: boolean): Promise<OperationResult> {
    const player = parsePlayerSymbol(this._game.currentPlayer);
    const strategy = this._strategies[player === "O" ? 0 : 1];
    const opponent = player === "O" ? "X" : "O";

    if (!this._publish(operation, "ai-thinking")) return { status: "aborted" };
    this._emit("ai-thinking", { player });
    if (!this._isCurrent(operation)) return { status: "aborted" };
    const selected = await this._selectMove(operation, strategy, player, opponent);
    if (!this._isCurrent(operation)) return { status: "aborted" };
    if (selected.status !== "success") return selected;

    this._game.savePlayerMove(selected.value);
    if (!this._isCurrent(operation)) return { status: "aborted" };
    const finished = this._game.gameStatus.status !== "running";
    const phase = finished ? "finished" : continuous ? "ai-thinking" : "ai-ready";
    if (!this._publish(operation, phase, finished || !continuous)) return { status: "aborted" };
    this._emit("move", { player, position: selected.value });
    if (!this._isCurrent(operation)) return { status: "aborted" };
    if (finished) this._emit("finished", { result: this._game.gameStatus });
    else this._emit("turn", { player: this._game.currentPlayer });
    return this._outcome(operation);
  }
}
