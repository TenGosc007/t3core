import type { AIInput, AIProvider, AIStrategy } from "@/index";

import { vi } from "vitest";

export type ChoiceOptions = { readonly prefer: "first" | "last" };

export function createProvider<Id extends string>(id: Id) {
  const inputs: AIInput[] = [];
  const signals: AbortSignal[] = [];
  const cleanups: ReturnType<typeof vi.fn>[] = [];
  const validateOptions = vi.fn((options: unknown): ChoiceOptions => {
    if (typeof options !== "object" || options === null || !("prefer" in options) ||
        (options.prefer !== "first" && options.prefer !== "last") ||
        Object.keys(options).some((key) => key !== "prefer")) {
      throw new TypeError("Expected prefer: first or last.");
    }
    return Object.freeze({ prefer: options.prefer });
  });
  const create = vi.fn((options: ChoiceOptions): AIStrategy => {
    const dispose = vi.fn();
    cleanups.push(dispose);
    return {
      async calculateMove(input, { signal }) {
        inputs.push(input);
        signals.push(signal);
        const moves = input.rules.getLegalMoves(input.board, input.aiSymbol);
        const move = options.prefer === "first" ? moves[0] : moves[moves.length - 1];
        if (move === undefined) throw new Error("No legal moves.");
        return move;
      },
      dispose,
    };
  });
  const provider: AIProvider<Id, ChoiceOptions> = {
    id, version: "1.0.0", supportedVariants: ["classic-3x3"],
    difficulties: [], defaultDifficulty: null, validateOptions, create,
  };
  return { provider, create, validateOptions, inputs, signals, cleanups };
}
