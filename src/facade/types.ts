import type { AIDifficulty } from "@/ai/types";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameVariant } from "@/game/types/Game.types";
import type { GameEventPayload, GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";
import type {
  GameSessionEventPayload,
  GameSessionEventType,
  PlayMoveResult,
  RunResult,
  StartResult,
} from "@/sessions/types";

/** AI engine configuration shared by all modes that involve AI. */
export type AIConfig = {
  /**
   * AI engine. Today:
   * - `'alphabeta'` — Alfa-Beta with difficulty levels (default)
   * - `'random'` — random legal move, no difficulty
   * Future: `'mcts'`, `'wasm'`.
   */
  engine?: "alphabeta" | "random";

  /** Difficulty level (only for `engine: 'alphabeta'`). Ignored by `random`. */
  difficulty?: AIDifficulty;

  /** Optional RNG seed for reproducibility (tests, benchmarks). */
  seed?: number;
};

/** Base options for every mode. Symbols are fixed (`['O','X']`, 'O' starts). */
type BaseOptions = {
  /** Game variant. Today only `'classic-3x3'` (default). Future: `'5x5'`, etc. */
  variant?: GameVariant;
};

/** PvP options. */
export type PvpOptions = BaseOptions & {
  mode: "pvp";
};

/** Single Player (human vs AI) options. */
export type SinglePlayerOptions = BaseOptions & {
  mode: "singleplayer";

  /**
   * Symbol of the human player. `'O'` = human starts (default), `'X'` = AI
   * starts. The symbol implies turn order — no separate `startsFirst` field.
   */
  humanSymbol?: PlayerSymbol;

  /** AI config. Default: `{ engine: 'alphabeta', difficulty: 'hard' }`. */
  ai?: AIConfig;
};

/** AI vs AI options (benchmarks, demos). */
export type AivsAiOptions = BaseOptions & {
  mode: "aivsai";

  /** Config for player 1 ('O', starts) and player 2 ('X'). */
  aiPlayers: [AIConfig, AIConfig];
};

export type TicTacToeOptions = PvpOptions | SinglePlayerOptions | AivsAiOptions;

/** Common read-only accessors shared by all instance interfaces. */
type InstanceAccessors = {
  readonly board: BoardSnapshot;
  readonly currentPlayer: PlayerSymbol;
  readonly gameStatus: GameStatus;
  readonly snapshot: GameEventPayload;
  readonly movesCount: number;
};

/** Common event subscription + reset methods. */
type InstanceEvents = {
  on<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): unknown;
  off<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): unknown;
  reset(): void;
};

/** PvP instance — `playMove` + `start` + `reset` + events. No `step`/`run`. */
export interface PvPInstance extends InstanceAccessors, InstanceEvents {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
  readonly mode: "pvp";
}

/** Single Player instance — same surface as PvP. No `step`/`run`. */
export interface SinglePlayerInstance
  extends InstanceAccessors, InstanceEvents {
  start(): Promise<StartResult>;
  playMove(index: number): Promise<PlayMoveResult>;
  readonly mode: "singleplayer";
}

/** AI vs AI instance — `step` + `run` + `reset` + events. No `playMove`/`start`. */
export interface AivsAiInstance extends InstanceAccessors, InstanceEvents {
  step(): Promise<PlayMoveResult>;
  run(): Promise<RunResult>;
  readonly mode: "aivsai";
}

/** Overloaded construct signatures — the instance type depends on `mode`. */
export interface TicTacToeConstructor {
  new (options: PvpOptions): PvPInstance;
  new (options: SinglePlayerOptions): SinglePlayerInstance;
  new (options: AivsAiOptions): AivsAiInstance;
}
