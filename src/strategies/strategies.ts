import type { GameStrategy } from "./strategies.types";

import { GameVariant } from "../types/Game.types";
import { classic3x3Strategy } from "./variants/classic3x3";

export const GAME_STRATEGIES = {
  [GameVariant.CLASSIC_3X3]: classic3x3Strategy,
} satisfies Record<GameVariant, GameStrategy>;
