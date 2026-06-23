import { expect, test } from "vitest";

import { resolveGameStrategy } from "../strategies";
import { GameVariant, type GameOptions } from "../types/Game.types";

test("resolveGameStrategy returns classic 3x3 strategy by default", () => {
  const strategy = resolveGameStrategy({});

  expect(strategy.boardSize).toBe(9);
  expect(strategy.getWinner(["O", "O", "O", 4, 5, 6, 7, 8, 9])).toBe("O");
});

test("resolveGameStrategy returns classic 3x3 strategy for explicit variant", () => {
  const strategy = resolveGameStrategy({ variant: GameVariant.CLASSIC_3X3 });

  expect(strategy.boardSize).toBe(9);
  expect(strategy.getWinner([1, "X", 3, 4, "X", 6, 7, "X", 9])).toBe("X");
});

test("resolveGameStrategy rejects unsupported variants", () => {
  const options = { variant: "unknown" } as unknown as GameOptions;

  expect(() => resolveGameStrategy(options)).toThrow(
    "Unsupported game variant: unknown",
  );
});

test("resolveGameStrategy keeps deprecated boardSize compatibility for classic 3x3", () => {
  expect(resolveGameStrategy({ boardSize: 9 }).boardSize).toBe(9);
  expect(() => resolveGameStrategy({ boardSize: 16 })).toThrow(
    "arbitrary board sizes are not supported",
  );
});
