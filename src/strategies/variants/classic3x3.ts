import type { GameStrategy } from "../strategies.types";

import { getWinnerFromFields } from "../../utils/getWinnerFromFields";

const WINNING_COMBINATIONS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const classic3x3Strategy: GameStrategy = {
  boardSize: 9,
  getWinner: (fields) => getWinnerFromFields(fields, WINNING_COMBINATIONS),
};
