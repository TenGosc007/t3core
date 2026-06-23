import type { GameStrategy } from "../strategies.types";

import { getWinnerFromFields } from "../../utils/getWinnerFromFields";

export const classic3x3Strategy: GameStrategy = {
  boardSize: 9,
  getWinner: getWinnerFromFields,
};
