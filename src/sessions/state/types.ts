/** Immutable session state shared by runtime sessions and the facade. */
import type { EngineError } from "../results";
import type {
  BoardSnapshot,
  FinishedGameStatus,
  GameStatus,
  PlayerSymbol,
  RunningGameStatus,
  VariantDescriptor,
} from "@/game/contracts";

/** Mode and human symbol: O/X in singleplayer, otherwise null. */
export type SessionIdentity =
  | {
    /** Local human-vs-human play. */
    readonly mode: "pvp";
    /** No single human symbol is assigned in PvP. */
    readonly humanSymbol: null
  }
  | {
    /** One human against one AI engine. */
    readonly mode: "singleplayer";
    /** Human-controlled symbol; the AI controls the other O/X symbol. */
    readonly humanSymbol: PlayerSymbol
  }
  | {
    /** Two AI engines controlled by step() or run(). */
    readonly mode: "aivsai";
    /** No human symbol is assigned in AI-vs-AI. */
    readonly humanSymbol: null
  };

/** Local PvP, human-vs-AI singleplayer, or AI-vs-AI autoplay/stepping. */
export type SessionMode = SessionIdentity["mode"];

type HumanIdentity = Exclude<SessionIdentity, { readonly mode: "aivsai" }>;
type AIIdentity = Exclude<SessionIdentity, { readonly mode: "pvp" }>;

type SnapshotBase = {
  /** Frozen row-major position; numeric labels are empty and O/X are occupied. */
  readonly board: BoardSnapshot;
  /** Frozen dimensions and winning-line metadata for the selected variant. */
  readonly variant: VariantDescriptor;
  /** Current O/X symbol in this position; O opens each new game. */
  readonly currentPlayer: PlayerSymbol;
  /** Occupied cell count in the current position, including after undo. */
  readonly movesCount: number;
  /** Whether a prior decision can be restored; an AI opening alone is not undoable. */
  readonly canUndo: boolean;
};

type RunningState = {
  /** Position result; phase separately describes the session lifecycle. */
  readonly gameStatus: RunningGameStatus;
  /** Legal zero-based cells for the position; use canPlay to gate human input. */
  readonly legalMoves: readonly number[];
  /** Serializable AI failure, or null when no AI error is retained. */
  readonly error: null;
};

/**
 * Complete frozen render state. Read it through getSnapshot() or snapshot;
 * its reference is stable until a state change. Phase-only updates reuse the
 * board and legalMoves arrays. Narrow phase to determine result/input types.
 * Use canPlay to enable human input, and ai-thinking for an AI progress indicator.
 * The union prevents contradictory phase/result/input states; board legality
 * and turn ownership are also validated at runtime.
 */
export type SessionSnapshot = SnapshotBase & (
  | (SessionIdentity & RunningState & {
    /** Constructed but not started; no opening move has been calculated. */
    readonly phase: "idle";
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: false;
  })
  | (HumanIdentity & RunningState & {
    /** Ready for human input through playMove(). */
    readonly phase: "human-turn";
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: true;
  })
  | (Extract<SessionIdentity, { readonly mode: "aivsai" }> & RunningState & {
    /** AI-vs-AI is ready but inactive; call step() or run(). */
    readonly phase: "ai-ready";
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: false;
  })
  | (AIIdentity & RunningState & {
    /** An AI operation is active; show progress and disable human input. */
    readonly phase: "ai-thinking";
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: false;
  })
  | (SessionIdentity & RunningState & {
    /** Paused; resume with start() in human modes or step()/run() in AI-vs-AI. */
    readonly phase: "paused";
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: false;
  })
  | (SessionIdentity & {
    /** A win or draw; restart for a new game or undo when available. */
    readonly phase: "finished";
    /** Position result; phase separately describes the session lifecycle. */
    readonly gameStatus: FinishedGameStatus;
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: false;
    /** Legal zero-based cells for the position; use canPlay to gate human input. */
    readonly legalMoves: readonly [];
    /** Serializable AI failure, or null when no AI error is retained. */
    readonly error: null;
  })
  | (AIIdentity & {
    /** AI failure; recover with restart() or a valid undo(). */
    readonly phase: "error";
    /** Position result; phase separately describes the session lifecycle. */
    readonly gameStatus: RunningGameStatus;
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: false;
    /** Legal zero-based cells for the position; use canPlay to gate human input. */
    readonly legalMoves: readonly number[];
    /** Serializable AI failure, or null when no AI error is retained. */
    readonly error: EngineError;
  })
  | (SessionIdentity & {
    /** Permanently closed; the last position/result/error remain readable. */
    readonly phase: "disposed";
    /** Position result; phase separately describes the session lifecycle. */
    readonly gameStatus: GameStatus;
    /** Whether human input through playMove() is currently enabled. */
    readonly canPlay: false;
    /** Always false after permanent disposal. */
    readonly canUndo: false;
    /** Legal zero-based cells for the position; use canPlay to gate human input. */
    readonly legalMoves: readonly number[];
    /** Serializable AI failure, or null when no AI error is retained. */
    readonly error: EngineError | null;
  })
);

/** Session snapshot narrowed to a particular game mode. */
export type SnapshotFor<Mode extends SessionMode> = Extract<
  SessionSnapshot,
  { readonly mode: Mode }
>;
