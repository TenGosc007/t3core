/**
 * Core game logic for Tic Tac Toe.
 *
 * Manages player turns, board state, win/draw detection, move history, and events.
 */
export { Game } from "@/game/Game";

/**
 * Options for configuring a `Game` instance.
 * @property variant - Predefined game variant.
 */
export type { GameOptions } from "@/game/types/Game.types";

/**
 * Default player symbols: `['O', 'X']`.
 */
export { DEFAULT_GAME_SYMBOLS } from "@/constants/gameConstants";

/**
 * Interface describing the `Game` class contract.
 */
export type { IGame } from "@/game/types/Game.types";

/**
 * Game event names. Use `STATE_CHANGE` for all state updates.
 */
export { GameEvent } from "@/game/types/Game.types";

/**
 * Predefined game variants.
 */
export { GameVariant } from "@/game/types/Game.types";

/**
 * Result status of restoring a historical move.
 */
export { BackToMoveStatus } from "@/game/types/Game.types";

/**
 * Result status of a player move: `success`, `already_selected`, `game_not_running`, `invalid_index`.
 */
export { PlayerMoveStatus } from "@/game/types/Game.types";

/**
 * Typed event map for `eventemitter3` — use with `Game` listeners.
 */
export type {
  BackToMoveStatus as BackToMoveStatusType,
  GameEventMap,
  GameEventPayload,
} from "@/game/types/Game.types";

/**
 * Union type representing possible game states:
 * - `{ status: 'running' }` - Game in progress
 * - `{ status: 'win', winner: PlayerSymbol }` - A player won
 * - `{ status: 'draw' }` - Board full, no winner
 */
export type { GameStatus } from "@/game/types/Game.types";

/**
 * Union type representing supported predefined game variants.
 */
export type { GameVariant as GameVariantType } from "@/game/types/Game.types";

/**
 * Tuple type for player symbols: `[symbol1, symbol2]`.
 *
 * @example
 * ```ts
 * type Symbols = ['O', 'X']; // PlayerSymbols
 * type Symbol = 'O' | 'X';   // PlayerSymbol
 * ```
 */
export type { PlayerSymbols, PlayerSymbol } from "@/game/types/Symbol.types";

/**
 * Union type for a board cell and readonly board snapshots exposed by the public API.
 */
export type {
  BoardField,
  BoardSnapshot,
  IBoard,
} from "@/game/types/Board.types";

// ─── AI (Single Player) ────────────────────────────────────────────────

/**
 * Stateless helper that computes the best move for `game.currentPlayer`
 * without mutating the game. The caller applies the move via `game.savePlayerMove`.
 */
export { getBestMove } from "@/ai";

/**
 * AI difficulty levels: `NORMAL` (casual, depth 1, 30% mistakes) and
 * `HARD` (strong, depth 4, 10% mistakes). No `EASY` for 3x3 in v2.0.
 */
export { AIDifficulty } from "@/ai";

/**
 * Options for `getBestMove`: `difficulty`, `symbol`,
 * `opponentSymbol`, `seed`.
 */
export type { AIOptions, AIMoveResult } from "@/ai";

// ─── Strategies (v2.1) ─────────────────────────────────────────────────

/**
 * Alfa-Beta pruning strategy implementing {@link MoveStrategy}. Persistent
 * RNG — one seed gives a reproducible move sequence across a whole game.
 */
export { AlphaBetaStrategy } from "@/ai";

/**
 * Random legal-move strategy implementing {@link MoveStrategy}. Useful as a
 * baseline opponent for tests, demos, and difficulty benchmarks.
 */
export { RandomStrategy } from "@/ai";

/**
 * Strategy interface and context for custom AI implementations.
 */
export type { MoveStrategy, MoveContext, GameView } from "@/ai";

/**
 * Error thrown by a strategy (or by a session validating a strategy's result).
 */
export { MoveStrategyError } from "@/ai";

// ─── Sessions (v2.1) ───────────────────────────────────────────────────

/**
 * Local two-player session. No AI — each `playMove` applies one human move.
 */
export { PvPGame } from "@/sessions/PvPGame";

/**
 * Human-vs-AI session. `playMove(index)` applies the human's move and
 * automatically triggers the AI's reply.
 */
export { SinglePlayerGame } from "@/sessions/SinglePlayerGame";

/**
 * AI-vs-AI session. Exposes `step()` (one AI move) and `run()` (auto-play
 * to the end). Useful for benchmarks and demos.
 */
export { AIGame } from "@/sessions/AIGame";

/**
 * Common contract for human-driven sessions (`PvPGame`, `SinglePlayerGame`).
 */
export type {
  GameSession,
  GameSessionEvent,
  GameSessionEventType,
  GameSessionEventPayload,
  PlayMoveResult,
  StartResult,
  RunResult,
} from "@/sessions/types";

// ─── Facade (v2.1) ─────────────────────────────────────────────────────

/**
 * Facade entry point. Use as `new TicTacToe({ mode: ... })`. The returned
 * instance type depends on `mode` (PvP / SinglePlayer / AivsAi).
 */
export { TicTacToe } from "@/facade/TicTacToe";

/**
 * Facade option types and per-mode instance interfaces.
 */
export type {
  TicTacToeOptions,
  PvpOptions,
  SinglePlayerOptions,
  AivsAiOptions,
  AIConfig,
  PvPInstance,
  SinglePlayerInstance,
  AivsAiInstance,
  TicTacToeConstructor,
} from "@/facade/types";
