import type { PlayMoveResult, RestartResult, StartResult, StopResult, UndoResult } from "./results";
import type { SessionSnapshot } from "./state/types";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";
import type { EventEmitter } from "eventemitter3";

/**
 * Untyped event handler used internally by sessions to back the typed
 * `on`/`off` API. `eventemitter3` requires a homogeneous handler map, so we
 * erase the per-event payload type at the emitter boundary and restore it via
 * casts in each session's `on`/`off`/`_emit`.
 */
export type SessionHandler = (payload: Record<string, unknown>) => void;

/** Internal emitter type shared by `PvPGame`, `SinglePlayerGame`, `AIGame`. */
export type SessionEmitter = EventEmitter<Record<string, SessionHandler>>;

export type {
  ActionResult,
  PlayMoveResult,
  RestartResult,
  RunResult,
  StartResult,
  StepResult,
  StopResult,
  UndoResult,
} from "./results";

/** Events emitted by sessions. */
export type GameSessionEvent =
  | { type: "move"; player: PlayerSymbol; position: number }
  | { type: "ai-thinking"; player: PlayerSymbol }
  | { type: "turn"; player: PlayerSymbol }
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
  /** @deprecated Transitional API; prefer restart() for a new game. */
  reset(): void;
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
