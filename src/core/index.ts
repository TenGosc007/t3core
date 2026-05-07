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
