import type { EngineError } from "../results";
import type { SessionIdentity, SessionSnapshot } from "./types";
import type {
  BoardSnapshot,
  GameStatus,
  PlayerSymbol,
} from "@/game/contracts";
import type { Game } from "@/game/Game";

import { getUndoTarget } from "./getUndoTarget";

const NO_MOVES: readonly [] = Object.freeze([]);
const RUNNING = Object.freeze({ status: "running" as const });

export function parsePlayerSymbol(value: string): PlayerSymbol {
  if (value === "O" || value === "X") return value;
  throw new RangeError(`Expected player symbol O or X, got: ${value}`);
}

function isSessionBoard(board: readonly (number | string)[]): board is BoardSnapshot {
  return board.every(
    (field) => typeof field === "number" || field === "O" || field === "X",
  );
}

function readStatus(game: Game, previous?: SessionSnapshot): GameStatus {
  const status = game.gameStatus;
  if (status.status === "running") return RUNNING;
  if (status.status === "draw") {
    return previous?.gameStatus.status === "draw"
      ? previous.gameStatus
      : Object.freeze({ status: "draw" });
  }
  const winner = parsePlayerSymbol(status.winner);
  if (previous?.gameStatus.status === "win" && previous.gameStatus.winner === winner) {
    return previous.gameStatus;
  }
  return Object.freeze({ status: "win", winner });
}

/** Build only at a session commit boundary, after Game callbacks have returned. */
export function createSnapshot(
  game: Game,
  identity: SessionIdentity,
  phase: SessionSnapshot["phase"],
  error: EngineError | null,
  previous?: SessionSnapshot,
): SessionSnapshot {
  const board = game.board;
  if (!isSessionBoard(board)) throw new RangeError("Sessions require O/X symbols.");
  const currentPlayer = parsePlayerSymbol(game.currentPlayer);
  const gameStatus = readStatus(game, previous);
  const movesCount = board.filter((field) => typeof field === "string").length;
  const legalMoves = previous?.board === board
    ? previous.legalMoves
    : game.getLegalMoves();
  const common = {
    board,
    variant: game.variant,
    currentPlayer,
    movesCount,
    legalMoves,
    canUndo: getUndoTarget(game, identity) !== null,
  };

  if (phase === "disposed") {
    return Object.freeze({ ...common, ...identity, phase, gameStatus, error: error === null ? null : Object.freeze({ ...error }), canPlay: false, canUndo: false });
  }
  if (gameStatus.status !== "running") {
    return Object.freeze({ ...common, ...identity, phase: "finished", gameStatus, error: null, canPlay: false, legalMoves: NO_MOVES });
  }
  const running = { ...common, gameStatus, error: null };
  switch (phase) {
    case "idle":
      return Object.freeze({ ...running, ...identity, phase, canPlay: false });
    case "human-turn":
      if (identity.mode === "aivsai") break;
      return Object.freeze({ ...running, ...identity, phase, canPlay: true });
    case "ai-ready":
      if (identity.mode !== "aivsai") break;
      return Object.freeze({ ...running, ...identity, phase, canPlay: false });
    case "ai-thinking":
      if (identity.mode === "pvp") break;
      return Object.freeze({ ...running, ...identity, phase, canPlay: false });
    case "paused":
      return Object.freeze({ ...running, ...identity, phase, canPlay: false });
    case "error":
      if (identity.mode === "pvp" || error === null) break;
      return Object.freeze({ ...common, ...identity, phase, gameStatus, error: Object.freeze({ ...error }), canPlay: false });
    case "finished":
      break;
  }
  throw new Error(`Invalid session phase ${phase} for mode ${identity.mode}.`);
}
