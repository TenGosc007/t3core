import { expect, test } from "vitest";

import {
  BackToMoveStatus,
  DEFAULT_GAME_SYMBOLS,
  Game,
  GameEvent,
  GameVariant,
  PlayerMoveStatus,
} from "../index";

test("public API exports Game class", () => {
  const game = new Game();
  expect(game).toBeInstanceOf(Game);
});

test("public API exports DEFAULT_GAME_SYMBOLS", () => {
  expect(DEFAULT_GAME_SYMBOLS).toEqual(["O", "X"]);
});

test("public API exports GameVariant", () => {
  expect(GameVariant.CLASSIC_3X3).toBe("classic-3x3");
});

test("public API exports PlayerMoveStatus", () => {
  expect(PlayerMoveStatus.SUCCESS).toBe("success");
  expect(PlayerMoveStatus.INVALID_INDEX).toBe("invalid_index");
});

test("public API exports BackToMoveStatus", () => {
  expect(BackToMoveStatus.SUCCESS).toBe("success");
  expect(BackToMoveStatus.INVALID_HISTORY_INDEX).toBe("invalid_history_index");
});

test("public API exports GameEvent", () => {
  expect(GameEvent.STATE_CHANGE).toBe("STATE_CHANGE");
});
