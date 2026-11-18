import type { AIProvider, AIStrategy } from "./types";
import type { AIDifficulty } from "@/ai/difficulty";
import type { MoveStrategy } from "@/ai/types";

import { AlphaBetaStrategy } from "@/ai/engines/alphabeta/AlphaBetaStrategy";
import { RandomStrategy } from "@/ai/engines/random/RandomStrategy";

/** Provider versions change when move-selection behavior changes. */
const VERSION = "1.0.0";

function validate(options: unknown, allowDifficulty: boolean): { seed?: number; difficulty?: AIDifficulty } {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError("AI options must be an object.");
  }
  for (const key of Object.keys(options)) {
    if (key !== "seed" && !(allowDifficulty && key === "difficulty")) {
      throw new TypeError("Unsupported AI option: " + key);
    }
  }
  const seed = "seed" in options ? options.seed : undefined;
  const difficulty = "difficulty" in options ? options.difficulty : undefined;
  if (seed !== undefined && (typeof seed !== "number" || !Number.isFinite(seed))) {
    throw new TypeError("AI seed must be a finite number.");
  }
  if (difficulty !== undefined && difficulty !== "normal" && difficulty !== "hard") {
    throw new TypeError("Unsupported AI difficulty: " + String(difficulty));
  }
  return { seed, ...(allowDifficulty ? { difficulty: difficulty ?? "normal" } : {}) };
}

function adapt(strategy: MoveStrategy): AIStrategy {
  return {
    async calculateMove(input, { signal }) {
      if (signal.aborted) throw new Error("AI request aborted.");
      return strategy.calculateMove(input.board, input);
    },
    dispose() {},
  };
}

const shared = {
  version: VERSION,
  supportedVariants: Object.freeze(["classic-3x3"]),
};

export const alphaBetaProvider: AIProvider<"alphabeta", { seed?: number; difficulty?: AIDifficulty }> =
  Object.freeze({
    ...shared,
    id: "alphabeta",
    difficulties: Object.freeze(["normal", "hard"]),
    defaultDifficulty: "normal",
    validateOptions: (options: unknown) => validate(options, true),
    create: (options: { seed?: number; difficulty?: AIDifficulty }) => adapt(new AlphaBetaStrategy(options)),
  });

export const randomProvider: AIProvider<"random", { seed?: number }> = Object.freeze({
  ...shared,
  id: "random",
  difficulties: Object.freeze([]),
  defaultDifficulty: null,
  validateOptions: (options: unknown) => validate(options, false),
  create: (options: { seed?: number }) => adapt(new RandomStrategy(options)),
});

export const BUILTIN_PROVIDERS: readonly AIProvider[] = Object.freeze([alphaBetaProvider, randomProvider]);
