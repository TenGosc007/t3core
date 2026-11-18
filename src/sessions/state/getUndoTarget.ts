import type { SessionIdentity } from "./types";
import type { Game } from "@/game/Game";

/** History indices count plies from the empty position; O always moves first. */
export function getUndoTarget(game: Game, identity: SessionIdentity): number | null {
  const count = game.board.filter((field) => typeof field === "string").length;
  if (count === 0) return null;
  if (identity.mode !== "singleplayer") return count - 1;

  const lastPlayer = (count - 1) % 2 === 0 ? "O" : "X";
  // Restore the position before the last human move, whether AI replied or not.
  const target = count - (lastPlayer === identity.humanSymbol ? 1 : 2);
  return target >= 0 ? target : null;
}
