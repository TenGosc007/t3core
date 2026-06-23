/**
 * Core game logic for Tic Tac Toe.
 *
 * Manages player turns, board state, win/draw detection, move history, and events.
 * All deprecated APIs are scheduled for removal in v2.0.
 */
export { Game } from "./game/Game";

/**
 * Options for configuring a `Game` instance.
 * @property variant - Predefined game variant.
 * @property boardSize - Deprecated. Use `variant` instead. Will be removed in v2.0.
 */
export type { GameOptions } from "./game/types/Game.types";

/**
 * Default player symbols: `['O', 'X']`.
 */
export { DEFAULT_GAME_SYMBOLS } from "./constants/gameConstants";

/**
 * Interface describing the `Game` class contract.
 */
export type { IGame } from "./game/types/Game.types";

/**
 * Game event names.
 *
 * `PLAYER_MOVE` and `RESET` are deprecated and will be removed in v2.0.
 * Use `STATE_CHANGE` for all state updates.
 */
export { GameEvent } from "./game/types/Game.types";

/**
 * Predefined game variants.
 */
export { GameVariant } from "./game/types/Game.types";

/**
 * Result status of restoring a historical move.
 */
export { BackToMoveStatus } from "./game/types/Game.types";

/**
 * Result status of a player move: `success`, `already_selected`, `game_not_running`, `invalid_index`.
 */
export { PlayerMoveStatus } from "./game/types/Game.types";

/**
 * Typed event map for `eventemitter3` — use with `Game` listeners.
 *
 * `PLAYER_MOVE` and `RESET` entries are deprecated and will be removed in v2.0.
 */
export type {
  BackToMoveStatus as BackToMoveStatusType,
  GameEventMap,
  GameEventPayload,
} from "./game/types/Game.types";

/**
 * Union type representing possible game states:
 * - `{ status: 'running' }` - Game in progress
 * - `{ status: 'win', winner: PlayerSymbol }` - A player won
 * - `{ status: 'draw' }` - Board full, no winner
 */
export type { GameStatus } from "./game/types/Game.types";

/**
 * Union type representing supported predefined game variants.
 */
export type { GameVariant as GameVariantType } from "./game/types/Game.types";

/**
 * Tuple type for player symbols: `[symbol1, symbol2]`.
 *
 * @example
 * ```ts
 * type Symbols = ['O', 'X']; // PlayerSymbols
 * type Symbol = 'O' | 'X';   // PlayerSymbol
 * ```
 */
export type { PlayerSymbols, PlayerSymbol } from "./game/types/Symbol.types";

/**
 * Union type for a board cell and readonly board snapshots exposed by the public API.
 */
export type {
  BoardField,
  BoardSnapshot,
  IBoard,
} from "./game/types/Board.types";
