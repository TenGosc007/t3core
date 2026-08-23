import type { Game } from "../game/Game";
import type {
  GameSession,
  GameSessionEventPayload,
  GameSessionEventType,
  PlayMoveResult,
  StartResult,
} from "./types";

import EventEmitter from "eventemitter3";

import { PlayerMoveStatus } from "../game/types/Game.types";

type SessionHandler = (payload: Record<string, unknown>) => void;
type SessionEmitter = EventEmitter<Record<string, SessionHandler>>;

/**
 * Local two-player session. No AI — each `playMove` applies one human move and
 * emits `move` + (`turn` | `finished`).
 */
export class PvPGame implements GameSession {
  private readonly _game: Game;
  private readonly _emitter: SessionEmitter = new EventEmitter();

  private _generation = 0;
  private _busyGeneration: number | null = null;
  private _lifecycle: "idle" | "started" | "finished" = "idle";

  constructor(options: { game: Game }) {
    this._game = options.game;
  }

  get board() {
    return this._game.board;
  }
  get currentPlayer() {
    return this._game.currentPlayer;
  }
  get gameStatus() {
    return this._game.gameStatus;
  }
  get snapshot() {
    return this._game.snapshot;
  }
  get movesCount() {
    return this._game.movesCount;
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

  reset(): void {
    this._generation++;
    this._busyGeneration = null;
    this._lifecycle = "idle";
    this._game.reset();
  }

  on<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this {
    this._emitter.on(event, handler as SessionHandler);
    return this;
  }

  off<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this {
    this._emitter.off(event, handler as SessionHandler);
    return this;
  }

  private _emit<K extends GameSessionEventType>(
    event: K,
    payload: GameSessionEventPayload<K>,
  ): void {
    this._emitter.emit(event, payload as Record<string, unknown>);
  }
}
