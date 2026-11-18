import type { SessionOperation } from "./operations/SessionOperation";
import type {
  ActionAborted,
  ActionError,
  ActionSuccess,
  OperationResult,
  PlayMoveResult,
  RestartResult,
  StartResult,
  StopResult,
  UndoResult,
} from "./results";
import type { SessionIdentity, SessionSnapshot } from "./state/types";
import type {
  GameSessionEventPayload,
  GameSessionEventType,
  SessionEmitter,
  SessionHandler,
} from "./types";
import type { MoveStrategy } from "@/ai";
import type { PlayerSymbol } from "@/game/contracts";
import type { Game } from "@/game/Game";

import { EventEmitter } from "eventemitter3";

import { MoveStrategyError } from "@/ai";

import { SessionOperation as Operation } from "./operations/SessionOperation";
import { getUndoTarget } from "./state/getUndoTarget";
import { SessionStore } from "./state/SessionStore";
import { isLegalMove } from "./utils";

export type { SessionOperation } from "./operations/SessionOperation";

/** Shared lifecycle, operation ownership, state publication and session events. */
export abstract class BaseSession {
  protected readonly _game: Game;
  protected readonly _emitter: SessionEmitter = new EventEmitter();
  protected _generation = 0;
  protected _busyOperation: SessionOperation | null = null;
  protected _disposed = false;
  private _latestOperation: SessionOperation | null = null;
  private readonly _store: SessionStore;

  constructor(game: Game, private readonly _identity: SessionIdentity) {
    this._game = game;
    this._store = new SessionStore(game, _identity);
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

  readonly getSnapshot = (): SessionSnapshot => this._store.getSnapshot();
  readonly subscribe = (callback: () => void): (() => void) =>
    this._disposed ? () => {} : this._store.subscribe(callback);

  /** @deprecated Transitional API. Use restart() to reset and start atomically. */
  reset(): void {
    if (this._disposed) return;
    this._invalidateOperations();
    const generation = this._generation;
    try {
      this._game.reset();
    } finally {
      if (this._generation === generation && this._latestOperation === null) {
        this._store.publish("idle");
      }
    }
  }

  async restart(): Promise<RestartResult> {
    if (this._disposed) return { status: "rejected", reason: "disposed" };
    this._invalidateOperations();
    const operation = this._beginOperation();
    try {
      this._game.reset();
      if (!this._isCurrent(operation)) return { status: "aborted" };
      if (this._identity.mode !== "aivsai" && !this._publish(operation, "idle")) {
        return { status: "aborted" };
      }
      const result = await this._resume(operation);
      return this._isCurrent(operation) ? result : { status: "aborted" };
    } finally {
      this._endOperation(operation);
    }
  }

  stop(): StopResult {
    if (this._disposed) return { status: "rejected", reason: "disposed" };
    const phase = this.snapshot.phase;
    const inactive = phase === "idle" || phase === "paused" ||
      phase === "finished" || phase === "error";
    if (this._busyOperation === null && inactive) {
      return { status: "success", value: undefined };
    }
    this._invalidateOperations();
    const operation = this._beginOperation();
    try {
      return this._complete(operation, "paused");
    } finally {
      this._endOperation(operation);
    }
  }

  undo(): UndoResult {
    if (this._disposed) return { status: "rejected", reason: "disposed" };
    const target = getUndoTarget(this._game, this._identity);
    if (target === null) return { status: "rejected", reason: "no_history" };
    const paused = this.snapshot.phase === "paused";
    this._invalidateOperations();
    const operation = this._beginOperation();
    try {
      this._game.backToMove(target);
      if (!this._isCurrent(operation)) return { status: "aborted" };
      return this._complete(operation, paused ? "paused" : this._readyPhase);
    } finally {
      this._endOperation(operation);
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._invalidateOperations();
    try {
      this._store.publish("disposed", this.snapshot.error);
    } finally {
      this._store.clear();
      this._emitter.removeAllListeners();
    }
  }

  on<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this {
    if (!this._disposed) this._emitter.on(event, handler as SessionHandler);
    return this;
  }

  off<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this {
    this._emitter.off(event, handler as SessionHandler);
    return this;
  }

  protected get _readyPhase(): "human-turn" | "ai-ready" {
    return this._identity.mode === "aivsai" ? "ai-ready" : "human-turn";
  }

  protected async _startSession(): Promise<StartResult> {
    const refusal = this._availability();
    if (refusal) return { status: "rejected", reason: refusal };
    if (this.snapshot.board === this._game.board &&
        (this.snapshot.phase === "human-turn" || this.snapshot.phase === "finished")) {
      return { status: "success", value: undefined };
    }
    const operation = this._beginOperation();
    try {
      const result = await this._resume(operation);
      return this._isCurrent(operation) ? result : { status: "aborted" };
    } finally {
      this._endOperation(operation);
    }
  }

  protected async _resume(operation: SessionOperation): Promise<OperationResult> {
    const finished = this._game.gameStatus.status !== "running";
    if (!this._publish(operation, finished ? "finished" : this._readyPhase, true)) {
      return { status: "aborted" };
    }
    if (!finished && this._identity.mode !== "aivsai") {
      this._emit("turn", { player: this._game.currentPlayer });
    }
    return this._outcome(operation);
  }

  protected _availability(): "disposed" | "busy" | "session_error" | null {
    if (this._disposed) return "disposed";
    if (this._busyOperation !== null) return "busy";
    if (this.snapshot.phase === "error" && this.snapshot.board === this._game.board) {
      return "session_error";
    }
    return null;
  }

  protected _playRefusal(): Extract<PlayMoveResult, { status: "rejected" }> | null {
    const unavailable = this._availability();
    if (unavailable) return { status: "rejected", reason: unavailable };
    switch (this.snapshot.phase) {
      case "idle": return { status: "rejected", reason: "not_started" };
      case "paused": return { status: "rejected", reason: "paused" };
      case "finished": return { status: "rejected", reason: "game_finished" };
      default: return null;
    }
  }

  protected _beginOperation(): SessionOperation {
    const operation = new Operation(this._generation);
    this._busyOperation = operation;
    this._latestOperation = operation;
    return operation;
  }

  protected _invalidateOperations(): void {
    ++this._generation;
    this._latestOperation?.cancel();
    this._latestOperation = null;
    this._busyOperation = null;
  }

  protected _isCurrent(operation: SessionOperation): boolean {
    return !this._disposed && this._generation === operation.generation &&
      this._latestOperation === operation;
  }

  protected _release(operation: SessionOperation): void {
    if (this._busyOperation === operation) this._busyOperation = null;
  }

  protected _outcome(operation: SessionOperation): ActionSuccess | ActionAborted {
    return this._isCurrent(operation)
      ? { status: "success", value: undefined }
      : { status: "aborted" };
  }

  protected _complete(
    operation: SessionOperation,
    phase: SessionSnapshot["phase"],
  ): ActionSuccess | ActionAborted {
    return this._publish(operation, phase, true)
      ? { status: "success", value: undefined }
      : { status: "aborted" };
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

  protected async _selectMove(
    operation: SessionOperation,
    strategy: MoveStrategy,
    aiSymbol: PlayerSymbol,
    opponentSymbol: PlayerSymbol,
  ): Promise<ActionSuccess<number> | ActionAborted | ActionError> {
    try {
      const selected = await operation.waitFor(strategy.calculateMove(this._game.board, {
        aiSymbol, opponentSymbol, gameStatus: this._game.gameStatus,
      }));
      if (!this._isCurrent(operation) || selected.status === "aborted") {
        return { status: "aborted" };
      }
      if (!isLegalMove(selected.value, this._game.board)) {
        throw new MoveStrategyError("illegal_move", "Strategy returned an illegal index: " + selected.value);
      }
      return selected;
    } catch (error) {
      if (!this._isCurrent(operation)) return { status: "aborted" };
      return this._failAI(operation, error);
    }
  }

  /** Callback errors thrown during publication escape this strategy-error handler. */
  private _failAI(operation: SessionOperation, cause: unknown): ActionError | ActionAborted {
    const error = Object.freeze({
      code: cause instanceof MoveStrategyError && cause.code === "illegal_move"
        ? "illegal_ai_move" as const
        : "ai_failed" as const,
      message: cause instanceof Error ? cause.message : "AI strategy failed.",
    });
    this._release(operation);
    this._store.publish("error", error);
    return this._isCurrent(operation) ? { status: "error", error } : { status: "aborted" };
  }

  protected _endOperation(operation: SessionOperation): void {
    if (this._busyOperation !== operation) return;
    this._release(operation);
    const interrupted = this.snapshot.phase === "ai-thinking" ||
      this.snapshot.board !== this._game.board;
    if (this._isCurrent(operation) && interrupted) {
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
    const generation = this._generation;
    const operation = this._latestOperation;
    for (const handler of this._emitter.listeners(event)) {
      if (this._disposed || this._generation !== generation ||
          this._latestOperation !== operation) break;
      if (this._emitter.listeners(event).includes(handler)) {
        handler(payload as Record<string, unknown>);
      }
    }
  }
}
