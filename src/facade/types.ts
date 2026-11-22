import type { CapabilitiesOptions, GameCapabilities } from "./catalog/types";
import type { PvpOptions, SinglePlayerOptions, AivsAiOptions, TicTacToeOptions, CheckedAIOptions } from "./options";
import type { AIProvider } from "@/ai/providers/types";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";
import type { SessionMode, SnapshotFor } from "@/sessions/state/types";
import type {
  GameSessionEventPayload,
  GameSessionEventType,
  PlayMoveResult,
  RestartResult,
  StepResult,
  StopResult,
  UndoResult,
  RunResult,
  StartResult,
} from "@/sessions/types";

export type { PvpOptions, SinglePlayerOptions, AivsAiOptions, TicTacToeOptions } from "./options";

/** Common read-only accessors shared by all instance interfaces. */
type InstanceAccessors<Mode extends SessionMode> = {
  /** Frozen board in row-major order; empty cells contain numeric labels. */
  readonly board: BoardSnapshot;
  /** Current O/X symbol. O always makes the opening move. */
  readonly currentPlayer: PlayerSymbol;
  /** Current running, win or draw result; lifecycle is exposed through snapshot.phase. */
  readonly gameStatus: GameStatus;
  /** The same frozen, cached session state returned by getSnapshot(). */
  readonly snapshot: SnapshotFor<Mode>;
  /**
   * Reads the complete session state without causing notifications.
   * This function is bound and stable. Its result keeps the same reference until
   * state changes; phase-only updates preserve board and legalMoves references.
   * @returns A frozen snapshot suitable for an external store subscription.
   */
  getSnapshot(): SnapshotFor<Mode>;
  /** Number of occupied cells in the current position, including after undo. */
  readonly movesCount: number;
};

/** Shared observation, events and lifecycle actions. */
type InstanceEvents = {
  /**
   * Observes snapshot changes, including phase changes without a board move.
   * Registration does not invoke the callback; read getSnapshot() once to render.
   * This function is bound and stable. Registrations after disposal are inert.
   * @param callback - Synchronous listener; read getSnapshot() inside it.
   * @returns Independent, idempotent unsubscribe function for this registration.
   * @example
   * const unsubscribe = game.subscribe(() => render(game.getSnapshot()));
   * render(game.getSnapshot());
   * // Call unsubscribe() when removing this subscription.
   */
  subscribe(callback: () => void): () => void;
  /**
   * Registers a synchronous gameplay listener. Snapshots are published before
   * their gameplay events; use subscribe() for rendering the complete state.
   * Callback exceptions propagate without rolling back applied moves.
   * @param event - move, turn, ai-thinking or finished.
   * @param handler - Listener receiving the event-specific payload.
   */
  on<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): unknown;
  /**
   * Removes a gameplay listener registered with on().
   * @param event - Event used during registration.
   * @param handler - The same function reference passed to on().
   */
  off<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): unknown;
  /**
   * Cancels pending work, clears the board and history, and clears AI errors.
   * Human-driven games start automatically, including an AI opening when needed.
   * AI-vs-AI returns to ai-ready; call step() or run() to continue.
   * Retains AI resources and their RNG sequences.
   * @returns Success, disposed refusal, cancellation or an AI failure during opening.
   */
  restart(): Promise<RestartResult>;
  /**
   * Synchronously cancels pending work and pauses without clearing the board.
   * Resume with start() in human modes or step()/run() in AI-vs-AI.
   * In idle, paused, finished or error state with no pending work, this is a no-op.
   * @returns Success, disposed refusal or aborted if a callback supersedes the action.
   */
  stop(): StopResult;
  /**
   * Cancels pending work and restores the previous decision without starting AI.
   * PvP and AI-vs-AI undo one ply. Singleplayer undoes the last human move and
   * its AI reply, if any. An AI opening alone cannot be undone.
   * A valid undo clears AI errors and preserves pause. No history means no cancellation.
   * @returns Success, no_history/disposed refusal, or aborted after a superseding callback.
   */
  undo(): UndoResult;
  /**
   * Permanently closes the game, cancels work, releases AI resources and removes
   * listeners. Repeated disposal is safe; the final snapshot remains readable.
   * Later actions refuse with disposed. For a reusable pause, call stop().
   * @throws Propagates subscriber or provider cleanup exceptions after cleanup.
   */
  dispose(): void;
};

/** PvP instance with human input and shared lifecycle actions. No `step`/`run`. */
export interface PvPInstance extends InstanceAccessors<"pvp">, InstanceEvents {
  /**
   * Starts or resumes local play. O opens a new game.
   * Repeated starts on active or finished games do not replay opening events.
   * @returns Success or a busy/session_error/disposed refusal; callbacks may supersede it.
   */
  start(): Promise<StartResult>;
  /**
   * Applies one move for the current player. Call start() before the first move.
   * @param index - Zero-based row-major cell index (0 through 8 on classic-3x3).
   * @returns An action result; invalid input is rejected without changing the board.
   */
  playMove(index: number): Promise<PlayMoveResult>;
  /** Local play with two human-controlled symbols. */
  readonly mode: "pvp";
}

/** Single Player instance — same surface as PvP. No `step`/`run`. */
export interface SinglePlayerInstance
  extends InstanceAccessors<"singleplayer">, InstanceEvents {
  /**
   * Starts or resumes play, awaiting an AI opening when the human is X.
   * Construction makes no moves: subscribe before calling this method.
   * Repeated starts on active or finished games do not replay turns.
   * @returns Success, refusal, cancellation or a serializable AI failure.
   */
  start(): Promise<StartResult>;
  /**
   * Applies a human move and awaits the AI reply unless the human ends the game.
   * Snapshots expose ai-thinking while waiting, then human-turn or finished.
   * @param index - Zero-based row-major cell index (0 through 8 on classic-3x3).
   * @returns Success, refusal, cancellation or a serializable AI failure.
   */
  playMove(index: number): Promise<PlayMoveResult>;
  /** One human symbol against one AI-controlled symbol. */
  readonly mode: "singleplayer";
}

/** AI-vs-AI instance with stepping, autoplay and shared lifecycle actions. No `playMove`/`start`. */
export interface AivsAiInstance extends InstanceAccessors<"aivsai">, InstanceEvents {
  /**
   * Starts or resumes AI-vs-AI and calculates exactly one move.
   * A nonterminal move returns to ai-ready; no start() call is required.
   * @returns Success, refusal (including game_finished), cancellation or AI failure.
   */
  step(): Promise<StepResult>;
  /**
   * Starts or resumes AI-vs-AI autoplay until a win, draw, cancellation or failure.
   * Publishes each move. Calling run() again after completion returns the existing
   * result without new moves or notifications. Use stop() to interrupt autoplay.
   * @returns An action result whose success value is the terminal win or draw.
   */
  run(): Promise<RunResult>;
  /** Two independently configured AI-controlled symbols. */
  readonly mode: "aivsai";
}

/** Game constructor and capability discovery; the instance API depends on mode. */
export interface TicTacToeConstructor {
  /**
   * Discovers compatible modes and engines without creating or initializing AI.
   * @param options - Variant and optional providers; defaults to classic-3x3 and built-ins.
   * @returns Frozen metadata for the selected variant.
   * @throws {TypeError} If query options or provider metadata are malformed, or IDs conflict.
   * @throws {RangeError} If the variant is unsupported.
   */
  getCapabilities(options?: CapabilitiesOptions): GameCapabilities;
  /**
   * Creates an idle PvP game. Subscribe, render once, then call start().
   * @param options - Local game configuration; no AI options are accepted.
   * @throws Throws synchronously for invalid configuration or provider metadata.
   * @example
   * const game = new TicTacToe({ mode: "pvp" });
   * await game.start();
   * await game.playMove(4);
   */
  new <const Providers extends readonly AIProvider[] = readonly []>(options: PvpOptions<Providers>): PvPInstance;
  /**
   * Creates an idle human-vs-AI game without calculating any moves.
   * @param options - Human symbol and AI configuration; defaults are O and normal alpha-beta.
   * @throws Throws synchronously for invalid configuration or provider construction failure.
   * @example
   * const game = new TicTacToe({ mode: "singleplayer", humanSymbol: "X" });
   * await game.start(); // AI plays O first.
   */
  new <const Providers extends readonly AIProvider[] = readonly [], const AI = unknown>(
    options: SinglePlayerOptions<Providers> & CheckedAIOptions<AI>,
  ): SinglePlayerInstance;
  /**
   * Creates an idle AI-vs-AI game. Call step() or run() to begin.
   * @param options - Two AI configurations, ordered O then X.
   * @throws Throws synchronously for invalid configuration or provider construction failure.
   * @example
   * const game = new TicTacToe({ mode: "aivsai", aiPlayers: [{}, { engine: "random" }] });
   * const result = await game.run();
   */
  new <const Providers extends readonly AIProvider[] = readonly [], const O = unknown, const X = unknown>(
    options: AivsAiOptions<Providers> & CheckedAIOptions<unknown, O, X>,
  ): AivsAiInstance;
  /**
   * Creates a game whose mode is known only at runtime. Literal modes match the
   * overloads above and keep their precise instance types; narrow this result by mode.
   * @param options - Any mode-specific configuration.
   * @throws Throws synchronously for invalid configuration or provider construction failure.
   */
  new <
    const Providers extends readonly AIProvider[] = readonly [],
    const AI = unknown,
    const O = unknown,
    const X = unknown,
  >(
    options: TicTacToeOptions<Providers> & CheckedAIOptions<AI, O, X>,
  ): PvPInstance | SinglePlayerInstance | AivsAiInstance;
}
