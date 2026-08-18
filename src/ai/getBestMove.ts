import type { BoardField, BoardSnapshot } from "../game/types/Board.types";
import type { IGame } from "../game/types/Game.types";
import type { PlayerSymbol } from "../game/types/Symbol.types";
import type { AIDifficulty, AIOptions, AIMoveResult } from "./types";

import { alphaBeta, MOVE_ORDER_3X3 } from "./alphaBeta";
import { AIDifficulty as AIDifficultyValue } from "./types";

/** Per-difficulty knobs: `maxDepth` caps the Alfa-Beta search, `mistakeRate` is the probability of a random move. */
const DIFFICULTY_CONFIG: Record<
  AIDifficulty,
  { maxDepth: number; mistakeRate: number }
> = {
  [AIDifficultyValue.NORMAL]: { maxDepth: 1, mistakeRate: 0.3 },
  [AIDifficultyValue.HARD]: { maxDepth: 4, mistakeRate: 0.1 },
};

/** Mulberry32 — fast seeded PRNG. Returns a function producing floats in `[0, 1)`. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scans the board for the first symbol that is not the AI's. Throws if none found. */
function inferOpponentSymbol(
  board: BoardSnapshot,
  aiSymbol: PlayerSymbol,
): PlayerSymbol {
  for (const field of board) {
    if (typeof field === "string" && field !== aiSymbol) return field;
  }
  throw new RangeError(
    `Cannot infer opponent symbol from the board (no symbol other than "${aiSymbol}" found). ` +
      `Pass options.opponentSymbol explicitly.`,
  );
}

/**
 * Computes the best move for `game.currentPlayer` using Alfa-Beta + difficulty knobs.
 *
 * Stateless — reads `game.board`, `game.gameStatus`, `game.currentPlayer` but does
 * **not** mutate the game. The caller is responsible for applying the move via
 * `game.savePlayerMove(index)`.
 *
 * @param game - The current game state. Must be the classic 3x3 variant (9-cell board).
 * @param options - Difficulty, symbols, and optional RNG seed.
 * @returns {@link AIMoveResult}:
 *   - `{ status: "success", index }` — a legal move was chosen.
 *   - `{ status: "no_moves" }` — the game is not running or the board is full.
 * @throws {RangeError} When the board is not 9 cells (3x3 variant only), or when
 *   the opponent symbol cannot be inferred from an empty board.
 */
export function getBestMove(
  game: IGame,
  options: AIOptions = {},
): AIMoveResult {
  const board = game.board;

  if (board.length !== 9) {
    throw new RangeError(
      `getBestMove supports only the 3x3 variant (9-cell board), got: ${board.length} cells.`,
    );
  }

  if (game.gameStatus.status !== "running") {
    return { status: "no_moves" };
  }

  const aiSymbol = options.symbol ?? game.currentPlayer;
  const opponentSymbol =
    options.opponentSymbol ?? inferOpponentSymbol(board, aiSymbol);

  const legalIndices = MOVE_ORDER_3X3.filter(
    (i) => typeof board[i] !== "string",
  );
  if (legalIndices.length === 0) {
    return { status: "no_moves" };
  }

  const difficulty = options.difficulty ?? AIDifficultyValue.HARD;
  const config = DIFFICULTY_CONFIG[difficulty];
  const rng =
    options.seed !== undefined ? mulberry32(options.seed) : Math.random;

  // Mistake: with probability `mistakeRate`, ignore Alfa-Beta and play a random legal move.
  if (rng() < config.mistakeRate) {
    const index = legalIndices[
      Math.floor(rng() * legalIndices.length)
    ] as number;
    return { status: "success", index };
  }

  // Evaluate each legal move with Alfa-Beta. `legalIndices` is already in move order
  // (center → corners → edges), so ties are broken deterministically for HARD.
  const fields = [...board] as BoardField[];
  let bestScore = -Infinity;
  let bestIndices: number[] = [];

  for (const index of legalIndices) {
    const original = fields[index] as BoardField;
    fields[index] = aiSymbol;
    const score = alphaBeta({
      fields,
      depth: 1,
      alpha: -Infinity,
      beta: Infinity,
      isMaximizing: false,
      aiSymbol,
      opponentSymbol,
      maxDepth: config.maxDepth,
    });
    fields[index] = original;

    if (score > bestScore) {
      bestScore = score;
      bestIndices = [index];
    } else if (score === bestScore) {
      bestIndices.push(index);
    }
  }

  // Tie-break: HARD = first by move order (deterministic); NORMAL = random among ties.
  const index =
    bestIndices.length === 1 || difficulty === AIDifficultyValue.HARD
      ? (bestIndices[0] as number)
      : (bestIndices[Math.floor(rng() * bestIndices.length)] as number);

  return { status: "success", index };
}
