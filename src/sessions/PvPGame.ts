import type { GameSession, PlayMoveResult, StartResult } from "./types";
import type { Game } from "@/game/Game";

import { PlayerMoveStatus } from "@/game/types/Game.types";

import { BaseSession } from "./BaseSession";

/** Local two-player orchestration; rules and state mutations belong to Game. */
export class PvPGame extends BaseSession implements GameSession {
  constructor(options: { game: Game }) {
    super(options.game, { mode: "pvp", humanSymbol: null });
  }

  async start(): Promise<StartResult> {
    if (this._busyOperation !== null) return { status: "busy" };
    if (this._lifecycle === "started") {
      throw new Error("start() called twice without reset().");
    }
    const operation = this._beginOperation();
    try {
      this._lifecycle = this._game.gameStatus.status === "running" ? "started" : "finished";
      const phase = this._lifecycle === "started" ? "human-turn" : "finished";
      if (!this._publish(operation, phase, true)) return { status: "aborted" };
      if (phase === "human-turn") this._emit("turn", { player: this._game.currentPlayer });
      return { status: this._isCurrent(operation) ? "success" : "aborted" };
    } finally {
      this._endOperation(operation);
    }
  }

  async playMove(index: number): Promise<PlayMoveResult> {
    if (this._busyOperation !== null) return { status: "busy" };
    if (this._lifecycle !== "started") return { status: "game_not_running" };
    const operation = this._beginOperation();
    try {
      const player = this._game.currentPlayer;
      const status = this._game.savePlayerMove(index);
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (status !== PlayerMoveStatus.SUCCESS) return { status };
      const finished = this._game.gameStatus.status !== "running";
      if (finished) this._lifecycle = "finished";
      if (!this._publish(operation, finished ? "finished" : "human-turn", true)) {
        return { status: "aborted" };
      }
      this._emit("move", { player, position: index });
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (finished) this._emit("finished", { result: this._game.gameStatus });
      else this._emit("turn", { player: this._game.currentPlayer });
      return { status: this._isCurrent(operation) ? "success" : "aborted" };
    } finally {
      this._endOperation(operation);
    }
  }
}
