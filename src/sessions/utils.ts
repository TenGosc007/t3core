import type { BoardSnapshot } from "@/game/types/Board.types";

/**
 * Returns true when `index` is an integer within the board range and the
 * corresponding field is empty (i.e. not yet claimed by a player).
 *
 * Used by sessions to validate a move returned by an AI strategy before
 * applying it — `Game.savePlayerMove` already validates human input, so
 * `PvPGame` does not need this helper.
 */
export function isLegalMove(index: number, board: BoardSnapshot): boolean {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < board.length &&
    typeof board[index] !== "string"
  );
}
