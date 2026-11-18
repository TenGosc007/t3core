/** Immutable session state shared by runtime sessions and the facade. */
import type { EngineError } from "../contracts/results";
import type {
  BoardSnapshot,
  FinishedGameStatus,
  GameStatus,
  PlayerSymbol,
  RunningGameStatus,
  VariantDescriptor,
} from "@/game/contracts";

export type SessionIdentity =
  | { readonly mode: "pvp"; readonly humanSymbol: null }
  | { readonly mode: "singleplayer"; readonly humanSymbol: PlayerSymbol }
  | { readonly mode: "aivsai"; readonly humanSymbol: null };

export type SessionMode = SessionIdentity["mode"];

type HumanIdentity = Exclude<SessionIdentity, { readonly mode: "aivsai" }>;
type AIIdentity = Exclude<SessionIdentity, { readonly mode: "pvp" }>;

type SnapshotBase = {
  readonly board: BoardSnapshot;
  readonly variant: VariantDescriptor;
  readonly currentPlayer: PlayerSymbol;
  readonly movesCount: number;
  readonly canUndo: boolean;
};

type RunningState = {
  readonly gameStatus: RunningGameStatus;
  readonly legalMoves: readonly number[];
  readonly error: null;
};

/**
 * The union prevents contradictory phase/result/input states. Cross-field
 * values such as turn ownership and board legality still need runtime checks.
 */
export type SessionSnapshot = SnapshotBase & (
  | (SessionIdentity & RunningState & {
    readonly phase: "idle";
    readonly canPlay: false;
    readonly canUndo: false;
  })
  | (HumanIdentity & RunningState & {
    readonly phase: "human-turn";
    readonly canPlay: true;
  })
  | (Extract<SessionIdentity, { readonly mode: "aivsai" }> & RunningState & {
    readonly phase: "ai-ready";
    readonly canPlay: false;
  })
  | (AIIdentity & RunningState & {
    readonly phase: "ai-thinking";
    readonly canPlay: false;
  })
  | (SessionIdentity & RunningState & {
    readonly phase: "paused";
    readonly canPlay: false;
  })
  | (SessionIdentity & {
    readonly phase: "finished";
    readonly gameStatus: FinishedGameStatus;
    readonly canPlay: false;
    readonly legalMoves: readonly [];
    readonly error: null;
  })
  | (AIIdentity & {
    readonly phase: "error";
    readonly gameStatus: RunningGameStatus;
    readonly canPlay: false;
    readonly legalMoves: readonly number[];
    readonly error: EngineError;
  })
  | (SessionIdentity & {
    readonly phase: "disposed";
    readonly gameStatus: GameStatus;
    readonly canPlay: false;
    readonly canUndo: false;
    readonly legalMoves: readonly number[];
    readonly error: EngineError | null;
  })
);

export type SnapshotFor<Mode extends SessionMode> = Extract<
  SessionSnapshot,
  { readonly mode: Mode }
>;
