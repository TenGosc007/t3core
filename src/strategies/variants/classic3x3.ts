import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { GameStrategy } from "@/strategies/strategies.types";

import { getWinnerFromFields } from "@/utils/getWinnerFromFields";

/** Shared with the classic alpha-beta search. */
export const WINNING_COMBINATIONS_3X3: readonly (readonly number[])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const descriptor = Object.freeze({
  id: "classic-3x3", rows: 3, columns: 3, winLength: 3, lineRule: "at-least" as const,
});
const getWinner = (fields: BoardSnapshot) =>
  getWinnerFromFields(fields, WINNING_COMBINATIONS_3X3);

function getStatus(fields: BoardSnapshot): Readonly<GameStatus> {
  const winner = getWinner(fields);
  if (winner !== null) return Object.freeze({ status: "win", winner });
  return Object.freeze({ status: fields.every((field) => typeof field === "string") ? "draw" : "running" });
}

function isLegalMove(fields: BoardSnapshot, index: number): boolean {
  return fields.length === 9 && Number.isInteger(index) && index >= 0 &&
    index < 9 && typeof fields[index] === "number" &&
    getStatus(fields).status === "running";
}

/** Immutable rule implementation: no session state, AI configuration or UI. */
export const classic3x3Strategy: GameStrategy = Object.freeze({
  descriptor,
  boardSize: 9,
  getWinner,
  getStatus,
  isLegalMove,
  getLegalMoves: (fields: BoardSnapshot) => Object.freeze(
    fields.length === 9 && getStatus(fields).status === "running"
      ? fields.flatMap((field, index) => typeof field === "number" ? [index] : [])
      : [],
  ),
});
