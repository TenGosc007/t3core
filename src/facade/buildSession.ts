import type { TicTacToeOptions } from "./options";
import type { AIProvider, AIStrategy } from "@/ai/providers/types";

import { disposeStrategies } from "@/ai/providers/disposeStrategies";
import { ProviderMoveStrategy } from "@/ai/providers/ProviderMoveStrategy";
import { Game } from "@/game/Game";
import { AIGame } from "@/sessions/AIGame";
import { PvPGame } from "@/sessions/PvPGame";
import { SinglePlayerGame } from "@/sessions/SinglePlayerGame";

import { ProviderCatalog } from "./catalog/ProviderCatalog";
import { validateOptions } from "./validateOptions";

export function buildSession(options: TicTacToeOptions<readonly AIProvider[]>): PvPGame | SinglePlayerGame | AIGame {
  validateOptions(options);
  const catalog = new ProviderCatalog(options.variant, options.aiProviders);
  const game = new Game({ variant: options.variant });
  if (options.mode === "pvp") return new PvPGame({ game });

  const factories = options.mode === "singleplayer"
    ? [catalog.prepare(options.ai)]
    : [catalog.prepare(options.aiPlayers[0]), catalog.prepare(options.aiPlayers[1])];
  const created: AIStrategy[] = [];
  const createPlayer = (index: number) => {
    const factory = factories[index];
    if (!factory) throw new Error("Missing AI player factory.");
    const strategy = factory();
    if (created.includes(strategy)) throw new TypeError("An AI factory must create a private strategy for each player.");
    if (strategy && typeof strategy.dispose === "function") created.push(strategy);
    if (!strategy || typeof strategy.calculateMove !== "function" || typeof strategy.dispose !== "function") {
      throw new TypeError("An AI factory must return a strategy with calculateMove and dispose.");
    }
    return new ProviderMoveStrategy(strategy, game.variant, game.rules);
  };
  try {
    const first = createPlayer(0);
    if (options.mode === "singleplayer") {
      const humanSymbol = options.humanSymbol ?? "O";
      return new SinglePlayerGame({
        game, strategy: first, humanSymbol, aiSymbol: humanSymbol === "O" ? "X" : "O",
      });
    }
    return new AIGame({ game, strategies: [first, createPlayer(1)] });
  } catch (error) {
    try { disposeStrategies(created); } catch { /* Keep the construction failure. */ }
    throw error;
  }
}
