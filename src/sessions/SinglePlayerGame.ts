import type { SessionOperation } from "./BaseSession";
import type { OperationResult } from "./results";
import type { GameSession, PlayMoveResult, StartResult } from "./types";
import type { MoveStrategy } from "@/ai";
import type { PlayerSymbol } from "@/game/contracts";
import type { Game } from "@/game/Game";

import { PlayerMoveStatus } from "@/game/types/Game.types";

import { BaseSession } from "./BaseSession";
import { parsePlayerSymbol } from "./state/createSnapshot";

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
    super(options.game, { mode: "singleplayer", humanSymbol }, [options.strategy]);
    this._strategy = options.strategy;
    this._humanSymbol = humanSymbol;
    this._aiSymbol = aiSymbol;
  }

  start(): Promise<StartResult> {
    return this._startSession();
  }

  protected override _resume(operation: SessionOperation): Promise<OperationResult> {
    if (this._game.gameStatus.status !== "running" ||
        this._game.currentPlayer === this._humanSymbol) {
      return super._resume(operation);
    }
    return this._runAiMove(operation);
  }

  async playMove(index: number): Promise<PlayMoveResult> {
    if (this._delivering) {
      const generation = this._generation;
      await this._afterDelivery();
      if (this._disposed || this._generation !== generation) return { status: "aborted" };
    }
    const refusal = this._playRefusal(index);
    if (refusal) return refusal;
    const operation = this._beginOperation();
    try {
      const status = this._game.savePlayerMove(index);
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (status !== PlayerMoveStatus.SUCCESS) {
        if (status === PlayerMoveStatus.GAME_NOT_RUNNING) {
          return { status: "rejected", reason: "game_finished" };
        }
        return { status: "rejected", reason: status };
      }
      const finished = this._game.gameStatus.status !== "running";
      if (!this._publish(operation, finished ? "finished" : "ai-thinking", finished)) {
        return { status: "aborted" };
      }
      this._emit("move", { player: this._humanSymbol, position: index });
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (finished) {
        this._emit("finished", { result: this._game.gameStatus });
        return this._outcome(operation);
      }
      const result = await this._runAiMove(operation);
      return this._isCurrent(operation) ? result : { status: "aborted" };
    } finally {
      this._endOperation(operation);
    }
  }

  private async _runAiMove(operation: SessionOperation): Promise<OperationResult> {
    if (!this._publish(operation, "ai-thinking")) return { status: "aborted" };
    this._emit("ai-thinking", { player: this._aiSymbol });
    if (!this._isCurrent(operation)) return { status: "aborted" };
    const selected = await this._selectMove(
      operation, this._strategy, this._aiSymbol, this._humanSymbol,
    );
    // A newer operation can start between asynchronous helper continuations.
    if (!this._isCurrent(operation)) return { status: "aborted" };
    if (selected.status !== "success") return selected;

    this._game.savePlayerMove(selected.value);
    if (!this._isCurrent(operation)) return { status: "aborted" };
    const finished = this._game.gameStatus.status !== "running";
    if (!this._publish(operation, finished ? "finished" : "human-turn", true)) return { status: "aborted" };
    this._emit("move", { player: this._aiSymbol, position: selected.value });
    if (!this._isCurrent(operation)) return { status: "aborted" };
    if (finished) this._emit("finished", { result: this._game.gameStatus });
    else this._emit("turn", { player: this._humanSymbol });
    return this._outcome(operation);
  }
}
