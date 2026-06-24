import type { GameStrategy } from "./strategies.types";

import { GameVariant, type GameOptions } from "../game/types/Game.types";
import { classic3x3Strategy } from "./variants/classic3x3";

/** Internal mapping of predefined {@link GameVariant} values to their strategies. */
const GAME_STRATEGIES = {
  [GameVariant.CLASSIC_3X3]: classic3x3Strategy,
} satisfies Record<GameVariant, GameStrategy>;

/**
 * Resolves the {@link GameStrategy} for the given options.
 *
 * @param options - Game creation options.
 * @returns The matching strategy for the selected variant.
 * @throws {RangeError} When the variant is unsupported or the deprecated `boardSize` does not match the variant.
 */
export const resolveGameStrategy = (options: GameOptions): GameStrategy => {
  const variant = options.variant ?? GameVariant.CLASSIC_3X3;
  const strategy = GAME_STRATEGIES[variant];

  if (!strategy) {
    throw new RangeError(`Unsupported game variant: ${variant}`);
  }

  validateBoardSize(options.boardSize ?? strategy.boardSize, strategy);

  return strategy;
};

/**
 * Validates the deprecated `boardSize` option.
 *
 * @deprecated This validation exists only for backwards compatibility. Will be removed in v2.0.
 */
function validateBoardSize(boardSize: number, strategy: GameStrategy): void {
  if (boardSize !== strategy.boardSize) {
    throw new RangeError(
      "`boardSize` is deprecated and arbitrary board sizes are not supported. Use a predefined `variant` instead.",
    );
  }
}
