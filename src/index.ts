/** Framework-independent game facade and provider failure contract. */
export { TicTacToe } from "./facade/TicTacToe";
export { AIProviderError } from "./ai/providers/AIProviderError";

export type {
  AIConfig, TicTacToeOptions, PvpOptions, SinglePlayerOptions, AivsAiOptions,
} from "./facade/options";
export type {
  TicTacToeConstructor, PvPInstance, SinglePlayerInstance, AivsAiInstance,
} from "./facade/types";
export type {
  BoardField, BoardSnapshot, PlayerSymbol, VariantId, VariantDescriptor,
  GameStatus, RunningGameStatus, FinishedGameStatus,
} from "./game/contracts";
export type { SessionSnapshot, SnapshotFor, SessionMode } from "./sessions/state/types";
export type {
  ActionResult, PlayMoveResult, StartResult, StepResult, RunResult,
  RestartResult, StopResult, UndoResult, EngineError, RejectionReason,
} from "./sessions/results";
export type { GameSessionEvent, GameSessionEventType, GameSessionEventPayload } from "./sessions/types";
export type { AIProvider, AIStrategy, AIInput, AIRequest, AIEngineMetadata } from "./ai/providers/types";
export type { GameCapabilities, CapabilitiesOptions } from "./facade/catalog/types";
export type { GameRules } from "./strategies/strategies.types";
