import type { GameSession, PlayMoveResult, StartResult } from "./types";
import type { Game } from "@/game/Game";

import { PlayerMoveStatus } from "@/game/types/Game.types";

import { BaseSession } from "./BaseSession";

/** Local two-player orchestration; rules and state mutations belong to Game. */
export class PvPGame extends BaseSession implements GameSession {
  constructor(options: { game: Game }) {
    super(options.game, { mode: "pvp", humanSymbol: null });
  }

  start(): Promise<StartResult> {
    return this._startSession();
  }

  async playMove(index: number): Promise<PlayMoveResult> {
    if (this._delivering && this._superseded(await this._afterDelivery())) return { status: "aborted" };
    const refusal = this._playRefusal(index);
    if (refusal) return refusal;
    const operation = this._beginOperation();
    try {
      const player = this._game.currentPlayer;
      const status = this._game.savePlayerMove(index);
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (status !== PlayerMoveStatus.SUCCESS) {
        if (status === PlayerMoveStatus.GAME_NOT_RUNNING) {
          return { status: "rejected", reason: "game_finished" };
        }
        return { status: "rejected", reason: status };
      }
      const finished = this._game.gameStatus.status !== "running";
      if (!this._publish(operation, finished ? "finished" : "human-turn", true)) {
        return { status: "aborted" };
      }
      this._emit("move", { player, position: index });
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (finished) this._emit("finished", { result: this._game.gameStatus });
      else this._emit("turn", { player: this._game.currentPlayer });
      return this._outcome(operation);
    } finally {
      this._endOperation(operation);
    }
  }
}
