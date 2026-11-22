import type { CapabilitiesOptions, GameCapabilities } from "./catalog/types";
import type { TicTacToeConstructor, TicTacToeOptions } from "./types";
import type { AIProvider } from "@/ai/providers/types";

import { buildSession } from "./buildSession";
import { ProviderCatalog } from "./catalog/ProviderCatalog";
import { createInstance } from "./instances";

/** Construction is synchronous; concrete facades expose only their mode's actions. */
class TicTacToeImpl {
  constructor(options: TicTacToeOptions<readonly AIProvider[]>) {
    return createInstance(buildSession(options));
  }

  static getCapabilities(options: CapabilitiesOptions = {}): GameCapabilities {
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError("Capabilities options must be an object.");
    }
    for (const key of Object.keys(options)) {
      if (key !== "variant" && key !== "aiProviders") throw new TypeError("Unsupported capabilities option: " + key);
    }
    if (options.variant !== undefined && typeof options.variant !== "string") {
      throw new TypeError("Variant must be a string identifier.");
    }
    if (options.aiProviders !== undefined && !Array.isArray(options.aiProviders)) {
      throw new TypeError("aiProviders must be an array.");
    }
    return new ProviderCatalog(options.variant, options.aiProviders).capabilities();
  }

}

/**
 * Creates a framework-independent Tic Tac Toe game with mode-specific actions.
 * Construction makes no moves. Subscribe and render once before calling start()
 * in human modes, or step()/run() in AI-vs-AI. O always starts; symbols are O and X.
 * Call dispose() when permanently removing the game.
 * @example
 * const game = new TicTacToe({ mode: "singleplayer" });
 * const unsubscribe = game.subscribe(() => render(game.getSnapshot()));
 * render(game.getSnapshot());
 * await game.start();
 * // On permanent removal: unsubscribe(); game.dispose();
 */
// TypeScript needs this overload boundary for mode-dependent constructor results.
// Source and installed-consumer tests verify the concrete instance types.
export const TicTacToe: TicTacToeConstructor =
  TicTacToeImpl as unknown as TicTacToeConstructor;
