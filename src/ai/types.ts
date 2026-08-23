import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

/** Context passed to a {@link MoveStrategy} alongside the board snapshot. */
export type MoveContext = {
  /** Symbol of the player whose move the strategy must choose. */
  aiSymbol: PlayerSymbol;
  /** Symbol of the opponent. */
  opponentSymbol: PlayerSymbol;
  /** Current game status from `Game.gameStatus`. */
  gameStatus: GameStatus;
};

/**
 * Strategy for choosing an AI move. Receives a board snapshot and a context,
 * returns a 0-based move index. Does **not** mutate `Game` — that is the
 * session's role.
 *
 * The API is asynchronous (`Promise`) on purpose — even though current
 * implementations are synchronous. This allows future use of Worker Threads /
 * Web Workers / WASM without changing the session API.
 *
 * Contract:
 * - If there are legal moves → returns an index of a legal (empty) field.
 * - If there are no legal moves (full board) → throws
 *   {@link MoveStrategyError} with code `no_legal_moves`.
 * - The returned index MUST be legal (empty field, within board range).
 *   The session validates the result defensively — if a strategy returns an
 *   illegal move, the session throws {@link MoveStrategyError} with code
 *   `illegal_move` and does not apply it. This protects against buggy or
 *   custom strategies.
 * - The strategy MUST NOT mutate `board` (the snapshot is readonly).
 */
export interface MoveStrategy {
  calculateMove(board: BoardSnapshot, context: MoveContext): Promise<number>;
}

/**
 * Error thrown by a strategy (or by the session when validating a strategy's
 * result). `code` distinguishes the two failure modes:
 * - `no_legal_moves` — the board is full, no move is possible.
 * - `illegal_move` — the strategy returned an index that is occupied or out
 *   of range; the session refuses to apply it.
 */
export class MoveStrategyError extends Error {
  constructor(
    public readonly code: "no_legal_moves" | "illegal_move",
    message: string,
  ) {
    super(message);
    this.name = "MoveStrategyError";
  }
}
