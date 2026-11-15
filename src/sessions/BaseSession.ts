import type {
  GameSessionEventPayload,
  GameSessionEventType,
  SessionEmitter,
  SessionHandler,
} from "./types";
import type { Game } from "@/game/Game";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameEventPayload, GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

import EventEmitter from "eventemitter3";

/**
 * Shared base for {@link PvPGame}, {@link SinglePlayerGame} and {@link AIGame}.
 *
 * Owns the common session machinery: the underlying {@link Game}, the typed
 * event emitter, the generation-based concurrency/reentrancy guard, and the
 * lifecycle state machine (`idle` → `started` → `finished`). Subclasses are
 * responsible for `start`/`playMove`/`step`/`run` — the parts that differ per
 * mode — and call {@link BaseSession#_emit} / {@link BaseSession#_beginTurn}
 * to drive the shared event/lifecycle plumbing.
 *
 * Not exported: only the per-mode session classes are part of the public API.
 */
export abstract class BaseSession {
  protected readonly _game: Game;
  protected readonly _emitter: SessionEmitter = new EventEmitter();

  /**
   * Bumped on every `reset()`. In-flight async work captures the generation
   * at start and bails out as `aborted` if it changes — this is how `reset()`
   * cancels a pending AI move without unawaitable side effects.
   */
  protected _generation = 0;
  protected _busyGeneration: number | null = null;
  protected _lifecycle: "idle" | "started" | "finished" = "idle";

  constructor(game: Game) {
    this._game = game;
  }

  get board(): BoardSnapshot {
    return this._game.board;
  }
  get currentPlayer(): PlayerSymbol {
    return this._game.currentPlayer;
  }
  get gameStatus(): GameStatus {
    return this._game.gameStatus;
  }
  get snapshot(): GameEventPayload {
    return this._game.snapshot;
  }
  get movesCount(): number {
    return this._game.movesCount;
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

  protected _emit<K extends GameSessionEventType>(
    event: K,
    payload: GameSessionEventPayload<K>,
  ): void {
    this._emitter.emit(event, payload as Record<string, unknown>);
  }
}
