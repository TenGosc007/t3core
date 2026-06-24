import { expect, test } from "vitest";

import {
  BackToMoveStatus,
  GameEvent,
  GameVariant,
  PlayerMoveStatus,
} from "../game/types/Game.types";

test("GameVariant.CLASSIC_3X3 equals 'classic-3x3'", () => {
  expect(GameVariant.CLASSIC_3X3).toBe("classic-3x3");
});

test("PlayerMoveStatus values are correct", () => {
  expect(PlayerMoveStatus.SUCCESS).toBe("success");
  expect(PlayerMoveStatus.ALREADY_SELECTED).toBe("already_selected");
  expect(PlayerMoveStatus.GAME_NOT_RUNNING).toBe("game_not_running");
  expect(PlayerMoveStatus.INVALID_INDEX).toBe("invalid_index");
});

test("BackToMoveStatus values are correct", () => {
  expect(BackToMoveStatus.SUCCESS).toBe("success");
  expect(BackToMoveStatus.INVALID_HISTORY_INDEX).toBe("invalid_history_index");
});

test("GameEvent values are correct", () => {
  expect(GameEvent.PLAYER_MOVE).toBe("PLAYER_MOVE");
  expect(GameEvent.RESET).toBe("RESET");
  expect(GameEvent.STATE_CHANGE).toBe("STATE_CHANGE");
});
