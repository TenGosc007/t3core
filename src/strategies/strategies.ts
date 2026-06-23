import type { GameStrategy } from "./strategies.types";

import { GameVariant, type GameOptions } from "../game/Game.types";
import { classic3x3Strategy } from "./variants/classic3x3";

const GAME_STRATEGIES = {
  [GameVariant.CLASSIC_3X3]: classic3x3Strategy,
} satisfies Record<GameVariant, GameStrategy>;

export const resolveGameStrategy = (options: GameOptions): GameStrategy => {
  const variant = options.variant ?? GameVariant.CLASSIC_3X3;
  const strategy = GAME_STRATEGIES[variant];

  if (!strategy) {
    throw new RangeError(`Unsupported game variant: ${variant}`);
  }

  validateBoardSize(options.boardSize ?? strategy.boardSize, strategy);

  return strategy;
};

function validateBoardSize(boardSize: number, strategy: GameStrategy): void {
  if (boardSize !== strategy.boardSize) {
    throw new RangeError(
      "`boardSize` is deprecated and arbitrary board sizes are not supported. Use a predefined `variant` instead.",
    );
  }
}
