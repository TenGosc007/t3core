import type { PlayerSymbol } from "@/core";

import { DEFAULT_GAME_SYMBOLS } from "@/core/constants";

const colorCodes = new Map<PlayerSymbol, number>([
  [DEFAULT_GAME_SYMBOLS[0], 32],
  [DEFAULT_GAME_SYMBOLS[1], 31],
]);

export const colorLabelSymbol = (label: number | PlayerSymbol) => {
  if (typeof label === "number") return `\x1b[90m${label}\x1b[0m`;

  const colorCode = colorCodes.get(label);
  return `\x1b[1;${colorCode}m${label}\x1b[0m`;
};
