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
 * TypeScript cannot express a constructor whose return type depends on options.
 * Keep that single overload boundary here; instances are checked by consumer tests.
 */
export const TicTacToe: TicTacToeConstructor =
  TicTacToeImpl as unknown as TicTacToeConstructor;
