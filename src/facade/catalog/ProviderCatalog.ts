import type { GameCapabilities } from "./types";
import type { AIProvider, AIStrategy } from "@/ai/providers/types";
import type { GameStrategy } from "@/strategies/strategies.types";

import { BUILTIN_PROVIDERS } from "@/ai/providers/builtins";
import { resolveGameStrategy } from "@/strategies/strategies";

/** Per-construction catalog. No global registrations or engine initialization. */
export class ProviderCatalog {
  readonly rules: GameStrategy;
  private readonly _providers = new Map<string, AIProvider>();

  constructor(
    variant?: string,
    providers: readonly AIProvider[] = [],
    ruleCatalog?: ReadonlyMap<string, GameStrategy>,
    builtins: readonly AIProvider[] = BUILTIN_PROVIDERS,
  ) {
    this.rules = resolveGameStrategy({ variant }, ruleCatalog);
    for (const provider of [...builtins, ...providers]) {
      this._validateMetadata(provider);
      if (this._providers.has(provider.id)) throw new TypeError("Duplicate AI provider: " + provider.id);
      // Copy metadata so later application mutations cannot change this catalog.
      this._providers.set(provider.id, Object.freeze({
        id: provider.id, version: provider.version,
        supportedVariants: Object.freeze([...provider.supportedVariants]),
        difficulties: Object.freeze([...provider.difficulties]),
        defaultDifficulty: provider.defaultDifficulty,
        validateOptions: provider.validateOptions.bind(provider),
        create: provider.create.bind(provider),
      }));
    }
  }

  capabilities(): GameCapabilities {
    const compatible = [...this._providers.values()].filter((provider) =>
      provider.supportedVariants.includes(this.rules.descriptor.id));
    return Object.freeze({
      variant: this.rules.descriptor,
      modes: Object.freeze(compatible.length > 0
        ? ["pvp", "singleplayer", "aivsai"] as const : ["pvp"] as const),
      defaultAIEngine: compatible.some((provider) => provider.id === "alphabeta") ? "alphabeta" : null,
      aiEngines: Object.freeze(compatible.map(({ id, version, difficulties, defaultDifficulty }) =>
        Object.freeze({ id, version, difficulties, defaultDifficulty }))),
    });
  }

  /** Validate every player's configuration before any factory is invoked. */
  prepare(config: object = {}): () => AIStrategy {
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      throw new TypeError("AI configuration must be an object.");
    }
    const options: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) if (key !== "engine") options[key] = value;
    const selectedEngine = "engine" in config ? config.engine : undefined;
    const engine = selectedEngine === undefined ? this.capabilities().defaultAIEngine : selectedEngine;
    if (typeof engine !== "string") throw new TypeError("No default AI engine for this variant.");
    const provider = this._providers.get(engine);
    if (!provider) throw new RangeError("Unknown AI engine: " + engine);
    if (!provider.supportedVariants.includes(this.rules.descriptor.id)) {
      throw new RangeError("AI engine " + engine + " does not support " + this.rules.descriptor.id);
    }
    if (options.difficulty !== undefined &&
        (typeof options.difficulty !== "string" || !provider.difficulties.includes(options.difficulty))) {
      throw new TypeError("Unsupported difficulty for AI engine " + engine);
    }
    if (options.difficulty === undefined && provider.defaultDifficulty !== null) {
      options.difficulty = provider.defaultDifficulty;
    }
    const normalized = provider.validateOptions(options);
    if (typeof normalized !== "object" || normalized === null || Array.isArray(normalized)) {
      throw new TypeError("AI option validation must return an options object.");
    }
    return () => provider.create(normalized);
  }

  private _validateMetadata(provider: AIProvider): void {
    if (!provider || typeof provider.id !== "string" || !provider.id.trim() ||
        typeof provider.version !== "string" || !provider.version.trim() ||
        !Array.isArray(provider.supportedVariants) ||
        !provider.supportedVariants.every((variant) => typeof variant === "string" && variant.length > 0) ||
        !Array.isArray(provider.difficulties) ||
        !provider.difficulties.every((level) => typeof level === "string" && level.length > 0) ||
        new Set(provider.supportedVariants).size !== provider.supportedVariants.length ||
        new Set(provider.difficulties).size !== provider.difficulties.length ||
        (provider.difficulties.length === 0
          ? provider.defaultDifficulty !== null
          : typeof provider.defaultDifficulty !== "string" || !provider.difficulties.includes(provider.defaultDifficulty)) ||
        typeof provider.validateOptions !== "function" || typeof provider.create !== "function") {
      throw new TypeError("Invalid AI provider metadata.");
    }
  }
}
