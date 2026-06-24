import { expect, test } from "vitest";

import { DEFAULT_GAME_SYMBOLS } from "../constants/gameConstants";

test("DEFAULT_GAME_SYMBOLS is ['O', 'X']", () => {
  expect(DEFAULT_GAME_SYMBOLS).toEqual(["O", "X"]);
});

test("DEFAULT_GAME_SYMBOLS is readonly tuple", () => {
  expect(DEFAULT_GAME_SYMBOLS[0]).toBe("O");
  expect(DEFAULT_GAME_SYMBOLS[1]).toBe("X");
  expect(DEFAULT_GAME_SYMBOLS.length).toBe(2);
});
