import type { MoveStrategy } from "@/ai/types";

import { vi } from "vitest";

import { Game } from "@/game/Game";
import { AIGame } from "@/sessions/AIGame";
import { SinglePlayerGame } from "@/sessions/SinglePlayerGame";

export const success = { status: "success", value: undefined };

export function deferredStrategy() {
  let resolve: (move: number) => void = () => { throw new Error("Not initialized"); };
  let reject: (error: unknown) => void = () => { throw new Error("Not initialized"); };
  const promise = new Promise<number>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  const calculateMove = vi.fn(() => promise);
  const strategy: MoveStrategy = { calculateMove };
  return { strategy, resolve, reject, calculateMove };
}

export const firstLegal: MoveStrategy = {
  calculateMove: async (board) => board.findIndex((field) => typeof field === "number"),
};

export function makeSingle(strategy: MoveStrategy = firstLegal, humanSymbol: "O" | "X" = "O") {
  return new SinglePlayerGame({
    game: new Game(), strategy, humanSymbol,
    aiSymbol: humanSymbol === "O" ? "X" : "O",
  });
}

export function makeAI(strategy: MoveStrategy = firstLegal) {
  return new AIGame({ game: new Game(), strategies: [strategy, strategy] });
}
