/**
 * Core game logic for Tic Tac Toe.
 * Manages player turns, board state, win/draw detection, and game lifecycle.
 */
export { Game } from "./Game";

/**
 * Default player symbols ['O', 'X'] for convenience.
 */
export { DEFAULT_GAME_SYMBOLS } from "./constants";

/**
 * Interface describing the Game class contract.
 */
export type { IGame } from "./types/Game";

/**
 * Game event names: `PLAYER_MOVE`, `RESET`.
 */
export { GameEvent } from "./types/Game";

/**
 * Result status of a player move: `success`, `already_selected`, `game_not_running`.
 */
export { PlayerMoveStatus } from "./types/Game";

/**
 * Typed event map for EventEmitter3 — use with `Game` listeners.
 */
export type { GameEventMap, GameEventPayload } from "./types/Game";

/**
 * Union type representing possible game states:
 * - `{ status: 'running' }` - Game in progress
 * - `{ status: 'win', winner: TSymbol }` - A player won
 * - `{ status: 'draw' }` - Board full, no winner
 */
export type { GameStatus } from "./types/Game";

/**
 * Tuple type for player symbols: `[symbol1, symbol2]`.
 *
 * @example
 * ```ts
 * type Symbols = ['O', 'X']; // PlayerSymbols
 * type Symbol = 'O' | 'X';   // PlayerSymbol
 * ```
 */
export type { PlayerSymbols, PlayerSymbol } from "./types/Symbol";
