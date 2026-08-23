import type { GameSession, PlayMoveResult, StartResult } from "./types";
import type { Game } from "@/game/Game";

import { PlayerMoveStatus } from "@/game/types/Game.types";

import { BaseSession } from "./BaseSession";

/**
 * Local two-player session. No AI — each `playMove` applies one human move and
 * emits `move` + (`turn` | `finished`).
 */
export class PvPGame extends BaseSession implements GameSession {
  constructor(options: { game: Game }) {
    super(options.game);
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
      this._emit("turn", { player: this._game.currentPlayer });
      if (this._generation !== gen) return { status: "aborted" };
      return { status: "success" };
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
      const player = this._game.currentPlayer;
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

      this._emit("move", { player, position: index });

      if (this._game.gameStatus.status !== "running") {
        this._lifecycle = "finished";
        this._emit("finished", { result: this._game.gameStatus });
        return { status: "success" };
      }

      this._emit("turn", { player: this._game.currentPlayer });
      return { status: "success" };
    } finally {
      if (this._busyGeneration === gen) this._busyGeneration = null;
    }
  }
}
