import type { SessionIdentity, SessionSnapshot } from "./state/types";
import type {
  GameSessionEventPayload,
  GameSessionEventType,
  SessionEmitter,
  SessionHandler,
} from "./types";
import type { Game } from "@/game/Game";

import { EventEmitter } from "eventemitter3";

import { MoveStrategyError } from "@/ai";

import { SessionStore } from "./state/SessionStore";

/** An operation owns its lock by identity, including within one generation. */
export type SessionOperation = { readonly generation: number };

/** Shared lifecycle, operation ownership, state publication and session events. */
export abstract class BaseSession {
  protected readonly _game: Game;
  protected readonly _emitter: SessionEmitter = new EventEmitter();
  protected _generation = 0;
  protected _busyOperation: SessionOperation | null = null;
  protected _lifecycle: "idle" | "started" | "finished" | "error" = "idle";
  private _latestOperation: SessionOperation | null = null;
  private readonly _store: SessionStore;

  constructor(game: Game, identity: SessionIdentity) {
    this._game = game;
    this._store = new SessionStore(game, identity);
  }

  get board() {
    return this.snapshot.board;
  }
  get currentPlayer() {
    return this.snapshot.currentPlayer;
  }
  get gameStatus() {
    return this.snapshot.gameStatus;
  }
  get snapshot(): SessionSnapshot {
    return this._store.getSnapshot();
  }
  get movesCount(): number {
    return this.snapshot.movesCount;
  }

  /** Stable functions can be passed directly to an external-store adapter. */
  readonly getSnapshot = (): SessionSnapshot => this._store.getSnapshot();
  readonly subscribe = (callback: () => void): (() => void) =>
    this._store.subscribe(callback);

  reset(): void {
    const generation = ++this._generation;
    this._latestOperation = null;
    this._busyOperation = null;
    this._lifecycle = "idle";
    try {
      this._game.reset();
    } finally {
      // Game callbacks may have started/reset a newer session before returning.
      if (this._generation === generation && this._latestOperation === null) {
        this._store.publish("idle");
      }
    }
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

  protected _beginOperation(): SessionOperation {
    const operation = { generation: this._generation };
    this._busyOperation = operation;
    this._latestOperation = operation;
    return operation;
  }

  protected _isCurrent(operation: SessionOperation): boolean {
    return this._generation === operation.generation &&
      this._latestOperation === operation;
  }

  protected _release(operation: SessionOperation): void {
    if (this._busyOperation === operation) this._busyOperation = null;
  }

  protected _publish(
    operation: SessionOperation,
    phase: SessionSnapshot["phase"],
    complete = false,
  ): boolean {
    if (!this._isCurrent(operation)) return false;
    if (complete) this._release(operation);
    this._store.publish(phase);
    return this._isCurrent(operation);
  }

  /** Only strategy failures go here; application callback errors propagate. */
  protected _failAI(operation: SessionOperation, error: unknown): void {
    if (!this._isCurrent(operation)) return;
    this._lifecycle = "error";
    this._release(operation);
    this._store.publish("error", {
      code: error instanceof MoveStrategyError && error.code === "illegal_move"
        ? "illegal_ai_move"
        : "ai_failed",
      message: error instanceof Error ? error.message : "AI strategy failed.",
    });
  }

  /**
   * A callback may throw after Game changes but before the session commits.
   * Refresh the position and clear thinking without masking that exception.
   */
  protected _endOperation(operation: SessionOperation): void {
    if (this._busyOperation !== operation) return;
    this._release(operation);
    const interrupted = this.snapshot.phase === "ai-thinking" ||
      this.snapshot.board !== this._game.board;
    if (this._isCurrent(operation) && interrupted) {
      this._lifecycle = "idle";
      try {
        this._store.publish("paused");
      } catch {
        // Preserve the original callback exception.
      }
    }
  }

  protected _emit<K extends GameSessionEventType>(
    event: K,
    payload: GameSessionEventPayload<K>,
  ): void {
    this._emitter.emit(event, payload as Record<string, unknown>);
  }
}
