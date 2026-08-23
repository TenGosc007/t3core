import type { BoardSnapshot } from "@/game/types/Board.types";
import type {
  GameEventPayload,
  GameStatus,
} from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

/** Lifecycle of a session — independent of `GameStatus`. */
export type SessionLifecycle = "idle" | "started" | "finished";

/** Result of `playMove(index)` on a session. */
export type PlayMoveResult =
  | { status: "success" }
  | { status: "invalid_index" }
  | { status: "already_selected" }
  | { status: "game_not_running" }
  | { status: "busy" } // playMove called while another playMove is in flight
  | { status: "aborted" }; // playMove aborted by reset() during AI computation

/** Result of `start()` on a session. */
export type StartResult =
  | { status: "success" }
  | { status: "busy" }
  | { status: "aborted" };

/** Result of `run()` on `AIGame`. */
export type RunResult =
  | { status: "completed"; result: GameStatus }
  | { status: "busy" }
  | { status: "aborted" };

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
  /**
   * Starts the game. Called ONCE after listeners are registered via `on`.
   * - PvP: emits `turn` for player 1 ('O').
   * - Single Player, human starts: emits `turn` for the human.
   * - Single Player, AI starts: emits `ai-thinking`, performs the AI move,
   *   then emits `turn` for the human (or `finished` if the AI won).
   *
   * The constructor does NOT perform moves — it is sync and cannot safely
   * run async AI before the UI registers listeners. `start()` solves this:
   * the UI calls `on()` after the constructor, then `await start()`.
   */
  start(): Promise<StartResult>;

  playMove(index: number): Promise<PlayMoveResult>;
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
  readonly snapshot: GameEventPayload;
  readonly movesCount: number;
}
