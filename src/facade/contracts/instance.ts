/** Internal v2 facade contract, not implemented by the exported constructor yet. */
import type { AivsAiOptions, PvpOptions, SinglePlayerOptions } from "./options";
import type { FinishedGameStatus, PlayerSymbol } from "@/game/contracts";
import type {
  PlayMoveResult,
  RestartResult,
  RunResult,
  StartResult,
  StepResult,
  StopResult,
  UndoResult,
} from "@/sessions/contracts/results";
import type { SessionMode, SnapshotFor } from "@/sessions/state/types";

type EventPayloads = {
  readonly move: { readonly player: PlayerSymbol; readonly position: number };
  readonly turn: { readonly player: PlayerSymbol };
  readonly "ai-thinking": { readonly player: PlayerSymbol };
  readonly finished: { readonly result: FinishedGameStatus };
};

interface Instance<Mode extends SessionMode> {
  readonly mode: Mode;
  /** Bound, stable and side-effect-free; returns the cached immutable state. */
  readonly getSnapshot: () => SnapshotFor<Mode>;
  /** No immediate notification; each subscription owns idempotent cleanup. */
  readonly subscribe: (callback: () => void) => () => void;
  on<Event extends keyof EventPayloads>(
    event: Event,
    handler: (payload: EventPayloads[Event]) => void,
  ): this;
  off<Event extends keyof EventPayloads>(
    event: Event,
    handler: (payload: EventPayloads[Event]) => void,
  ): this;
  restart(): Promise<RestartResult>;
  stop(): StopResult;
  undo(): UndoResult;
  dispose(): void;
}

export interface PvPInstance extends Instance<"pvp"> {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
}

export interface SinglePlayerInstance extends Instance<"singleplayer"> {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
}

export interface AivsAiInstance extends Instance<"aivsai"> {
  step(): Promise<StepResult>;
  run(): Promise<RunResult>;
}

export interface TicTacToeConstructor {
  new (options: PvpOptions): PvPInstance;
  new (options: SinglePlayerOptions): SinglePlayerInstance;
  new (options: AivsAiOptions): AivsAiInstance;
}
