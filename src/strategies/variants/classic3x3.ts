import type { GameStrategy } from "../strategies.types";

import { getWinnerFromFields } from "../../utils/getWinnerFromFields";

/**
 * Winning index combinations for the classic 3x3 Tic Tac Toe variant.
 * Single source of truth for win detection — reused by the AI's Alfa-Beta search.
 */
export const WINNING_COMBINATIONS_3X3: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Strategy for the classic 3x3 Tic Tac Toe variant. */
export const classic3x3Strategy: GameStrategy = {
  boardSize: 9,
  getWinner: (fields) => getWinnerFromFields(fields, WINNING_COMBINATIONS_3X3),
};
