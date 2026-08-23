import type { GameStrategy } from "./strategies.types";

import { GameVariant, type GameOptions } from "@/game/types/Game.types";
import { classic3x3Strategy } from "@/strategies/variants/classic3x3";

/** Internal mapping of predefined {@link GameVariant} values to their strategies. */
const GAME_STRATEGIES = {
  [GameVariant.CLASSIC_3X3]: classic3x3Strategy,
} satisfies Record<GameVariant, GameStrategy>;

/**
 * Resolves the {@link GameStrategy} for the given options.
 *
 * @param options - Game creation options.
 * @returns The matching strategy for the selected variant.
 * @throws {RangeError} When the variant is unsupported.
 */
export const resolveGameStrategy = (options: GameOptions): GameStrategy => {
  const variant = options.variant ?? GameVariant.CLASSIC_3X3;
  const strategy = GAME_STRATEGIES[variant];

  if (!strategy) {
    throw new RangeError(`Unsupported game variant: ${variant}`);
  }

  return strategy;
};
