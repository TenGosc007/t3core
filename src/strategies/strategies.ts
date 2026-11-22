import type { GameStrategy } from "./strategies.types";

import { classic3x3Strategy } from "./variants/classic3x3";

/** Internal immutable catalog; tests may supply an isolated catalog. */
const GAME_STRATEGIES: ReadonlyMap<string, GameStrategy> = new Map([
  ["classic-3x3", classic3x3Strategy],
]);

export function resolveGameStrategy(
  options: { readonly variant?: string },
  strategies: ReadonlyMap<string, GameStrategy> = GAME_STRATEGIES,
): GameStrategy {
  const variant = options.variant ?? "classic-3x3";
  const strategy = strategies.get(variant);
  if (!strategy) throw new RangeError("Unsupported game variant: " + variant);
  return strategy;
}
