import type { CapabilitiesOptions, GameCapabilities } from "./catalog/types";
import type { PvpOptions, SinglePlayerOptions, AivsAiOptions } from "./options";
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

export type { AIConfig, PvpOptions, SinglePlayerOptions, AivsAiOptions, TicTacToeOptions } from "./options";

/** Common read-only accessors shared by all instance interfaces. */
type InstanceAccessors<Mode extends SessionMode> = {
  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: SnapshotFor<Mode>;
  getSnapshot(): SnapshotFor<Mode>;
  readonly movesCount: number;
};

/** Shared observation, events and lifecycle actions. */
type InstanceEvents = {
  subscribe(callback: () => void): () => void;
  on<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): unknown;
  off<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): unknown;
  restart(): Promise<RestartResult>;
  stop(): StopResult;
  undo(): UndoResult;
  dispose(): void;
};

/** PvP instance with human input and shared lifecycle actions. No `step`/`run`. */
export interface PvPInstance extends InstanceAccessors<"pvp">, InstanceEvents {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
  readonly mode: "pvp";
}

/** Single Player instance — same surface as PvP. No `step`/`run`. */
export interface SinglePlayerInstance
  extends InstanceAccessors<"singleplayer">, InstanceEvents {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
  readonly mode: "singleplayer";
}

/** AI-vs-AI instance with stepping, autoplay and shared lifecycle actions. No `playMove`/`start`. */
export interface AivsAiInstance extends InstanceAccessors<"aivsai">, InstanceEvents {
  step(): Promise<StepResult>;
  run(): Promise<RunResult>;
  readonly mode: "aivsai";
}

/** Overloaded construct signatures — the instance type depends on `mode`. */
export interface TicTacToeConstructor {
  getCapabilities(options?: CapabilitiesOptions): GameCapabilities;
  new <const Providers extends readonly AIProvider[] = readonly []>(options: PvpOptions<Providers>): PvPInstance;
  new <const Providers extends readonly AIProvider[] = readonly []>(options: SinglePlayerOptions<Providers>): SinglePlayerInstance;
  new <const Providers extends readonly AIProvider[] = readonly []>(options: AivsAiOptions<Providers>): AivsAiInstance;
}
