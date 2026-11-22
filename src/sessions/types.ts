import type { PlayMoveResult, RestartResult, StartResult, StopResult, UndoResult } from "./results";
import type { SessionSnapshot } from "./state/types";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";
import type { EventEmitter } from "eventemitter3";

/**
 * Untyped event handler used internally by sessions to back the typed
 * `on`/`off` API. BaseSession isolates payload casts at the emitter boundary;
 * callers retain event-specific payload types through `on`/`off`/`_emit`.
 */
export type SessionHandler = (payload: Record<string, unknown>) => void;

/** Internal emitter owned by BaseSession and shared by all session modes. */
export type SessionEmitter = EventEmitter<Record<string, SessionHandler>>;

export type {
  PlayMoveResult,
  RestartResult,
  RunResult,
  StartResult,
  StepResult,
  StopResult,
  UndoResult,
} from "./results";

/**
 * Gameplay event union. on()/off() handlers receive the payload without type.
 * Events describe effects; subscribe() supplies complete render state first.
 */
export type GameSessionEvent =
  /** A move has been applied and its snapshot published. */
  | { type: "move"; player: PlayerSymbol; position: number }
  /** AI calculation is about to begin, after the thinking snapshot is published. */
  | { type: "ai-thinking"; player: PlayerSymbol }
  /** Control passes to the next player, or start() announces the human opening. */
  | { type: "turn"; player: PlayerSymbol }
  /** A terminal move has produced a win or draw. */
  | { type: "finished"; result: GameStatus };

/** Event type — used as the key in `on`/`off` for typed dispatch. */
export type GameSessionEventType = GameSessionEvent["type"];

/**
 * Maps an event type to its payload **without** the `type` field. Used by
 * `on`/`off` so a handler for `move` receives `{ player, position }`, not
 * `{ type: 'move', player, position }`.
 */
export type GameSessionEventPayload<K extends GameSessionEventType> = Omit<
  Extract<GameSessionEvent, { type: K }>,
  "type"
>;

/**
 * Common contract for human-driven sessions (`PvPGame`, `SinglePlayerGame`).
 * `AIGame` does NOT implement this interface — it has `step()`/`run()`
 * instead of `playMove()`/`start()`.
 */
export interface GameSession {
  /** Starts or resumes play; repeated starts do not replay opening events. */
  start(): Promise<StartResult>;

  playMove(index: number): Promise<PlayMoveResult>;
  restart(): Promise<RestartResult>;
  stop(): StopResult;
  undo(): UndoResult;
  dispose(): void;
  on<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this;
  off<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this;

  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: SessionSnapshot;
  getSnapshot(): SessionSnapshot;
  subscribe(callback: () => void): () => void;
  readonly movesCount: number;
}
