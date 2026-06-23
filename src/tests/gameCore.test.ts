import { expect, test, vi } from "vitest";

import { Game } from "../Game";
import { GameEvent, GameVariant } from "../types/Game";

/*
    O   X   O
    O   X   X
    X   O   O
*/
test("Check if the game ends in a draw", () => {
  const game = new Game();

  game.savePlayerMove(0);
  game.savePlayerMove(1);
  game.savePlayerMove(2);
  game.savePlayerMove(4);
  game.savePlayerMove(3);
  game.savePlayerMove(5);
  game.savePlayerMove(7);
  game.savePlayerMove(6);
  game.savePlayerMove(8);

  expect(game.gameStatus).toEqual({ status: "draw" });
});

test("Reset the game", () => {
  const game = new Game();
  game.savePlayerMove(4);
  game.savePlayerMove(0);
  game.savePlayerMove(1);
  game.savePlayerMove(2);
  game.savePlayerMove(7);
  game.reset();

  expect(game.board).toEqual(new Array(9).fill(0).map((_, idx) => idx + 1));
  expect(game.gameStatus.status).toBe("running");
  expect(game.currentPlayer).toBe("O");
});

test("creates a classic 3x3 game by default", () => {
  const game = new Game();

  expect(game.board).toEqual(new Array(9).fill(0).map((_, idx) => idx + 1));
});

test("creates a game from the classic 3x3 variant", () => {
  const game = new Game({ variant: GameVariant.CLASSIC_3X3 });

  expect(game.board).toEqual(new Array(9).fill(0).map((_, idx) => idx + 1));
});

test("deprecated boardSize only accepts the current classic 3x3 size", () => {
  expect(() => new Game({ boardSize: 16 })).toThrow(
    "arbitrary board sizes are not supported",
  );
  expect(new Game({ boardSize: 9 }).board).toEqual(
    new Array(9).fill(0).map((_, idx) => idx + 1),
  );
});

/*
    X   O   X
    4   O   6
    7   O   9
*/
test("Check if the game is won", () => {
  const game = new Game();
  game.savePlayerMove(4);
  game.savePlayerMove(0);
  game.savePlayerMove(1);
  game.savePlayerMove(2);
  game.savePlayerMove(7);

  expect(game.gameStatus).toEqual({ status: "win", winner: "O" });
  expect(game.isFieldSelectedByIndex(4)).toBe(true);
  expect(game.isFieldSelectedByIndex(8)).toBe(false);
});

test("PLAYER_MOVE event fires with correct payload on savePlayerMove", () => {
  const game = new Game();
  const listener = vi.fn();
  game.on(GameEvent.PLAYER_MOVE, listener);

  game.savePlayerMove(4);

  expect(listener).toHaveBeenCalledOnce();
  const payload = listener.mock.calls[0][0];
  expect(payload.index).toBe(4);
  expect(payload.board).toBeDefined();
  expect(payload.currentPlayer).toBeDefined();
  expect(payload.gameStatus).toBeDefined();
});

test("RESET event fires with snapshot payload", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.savePlayerMove(1);

  const listener = vi.fn();
  game.on(GameEvent.RESET, listener);
  game.reset();

  expect(listener).toHaveBeenCalledOnce();
  const payload = listener.mock.calls[0][0];
  expect(payload.gameStatus).toEqual({ status: "running" });
  expect(payload.board).toEqual(new Array(9).fill(0).map((_, idx) => idx + 1));
  expect(payload.currentPlayer).toBe("O");
});

test("PLAYER_MOVE event is not fired when move is invalid", () => {
  const game = new Game();
  game.savePlayerMove(0);
  const listener = vi.fn();
  game.on(GameEvent.PLAYER_MOVE, listener);

  game.savePlayerMove(0);

  expect(listener).not.toHaveBeenCalled();
});

test("savePlayerMove returns GAME_NOT_RUNNING after game is won", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.savePlayerMove(3);
  game.savePlayerMove(1);
  game.savePlayerMove(4);
  game.savePlayerMove(2);

  expect(game.gameStatus).toEqual({ status: "win", winner: "O" });
  const result = game.savePlayerMove(8);
  expect(result).toBe("game_not_running");
});

test("off() removes listener", () => {
  const game = new Game();
  const listener = vi.fn();
  game.on(GameEvent.PLAYER_MOVE, listener);
  game.off(GameEvent.PLAYER_MOVE, listener);
  game.savePlayerMove(0);

  expect(listener).not.toHaveBeenCalled();
});

test("multiple resets work correctly", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.reset();
  game.savePlayerMove(4);
  game.reset();

  expect(game.gameStatus.status).toBe("running");
  expect(game.currentPlayer).toBe("O");
  expect(game.board).toEqual(new Array(9).fill(0).map((_, idx) => idx + 1));
});

test("deprecated savePlayerSelection still works (1-9 numbering)", () => {
  const game = new Game();
  game.savePlayerSelection(5); // field 5 = index 4
  expect(game.isFieldSelectedByIndex(4)).toBe(true);
  expect(game.board[4]).toBe("O");
});

test("isFieldSelected and isFieldSelectedByIndex are equivalent", () => {
  const game = new Game();
  game.savePlayerMove(4);

  // isFieldSelected uses 1-9 numbering, isFieldSelectedByIndex uses 0-8
  expect(game.isFieldSelected(5)).toBe(true); // field 5
  expect(game.isFieldSelectedByIndex(4)).toBe(true); // index 4

  expect(game.isFieldSelected(1)).toBe(false);
  expect(game.isFieldSelectedByIndex(0)).toBe(false);
});

test("deprecated getBoard returns same as board getter", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.savePlayerMove(4);

  expect(game.getBoard()).toEqual(game.board);
});

test("savePlayerMove creates board history snapshots", () => {
  const game = new Game();
  expect(game.movesCount).toBe(0);

  game.savePlayerMove(0);
  expect(game.movesCount).toBe(1);

  game.savePlayerMove(1);
  expect(game.movesCount).toBe(2);
});

test("backToMove reverts to previous state", () => {
  const game = new Game();
  game.savePlayerMove(4); // move 0: O at index 4
  game.savePlayerMove(0); // move 1: X at index 0
  game.savePlayerMove(2); // move 2: O at index 2

  expect(game.board[4]).toBe("O");
  expect(game.board[0]).toBe("X");
  expect(game.board[2]).toBe("O");

  game.backToMove(1); // back to after move 0: only O at 4

  expect(game.board[4]).toBe("O");
  expect(game.board[0]).toBe(1);
  expect(game.board[2]).toBe(3);
});

test("savePlayerMove truncates history after backToMove when making new move", () => {
  const game = new Game();
  game.savePlayerMove(0); // move 0: O at index 0
  game.savePlayerMove(1); // move 1: X at index 1
  game.savePlayerMove(2); // move 2: O at index 2
  expect(game.movesCount).toBe(3);

  game.backToMove(1); // back to after move 1, current player becomes X
  expect(game.movesCount).toBe(3);

  game.savePlayerMove(4); // X at index 4
  expect(game.movesCount).toBe(2);
  expect(game.board[4]).toBe("X");
  expect(game.board[2]).toBe(3);
});

test("savePlayerMove returns ALREADY_SELECTED on occupied field", () => {
  const game = new Game();
  game.savePlayerMove(0);
  const result = game.savePlayerMove(0);
  expect(result).toBe("already_selected");
});

test("STATE_CHANGE event fires on savePlayerMove", () => {
  const game = new Game();
  const listener = vi.fn();
  game.on(GameEvent.STATE_CHANGE, listener);
  game.savePlayerMove(0);
  expect(listener).toHaveBeenCalledOnce();
  const payload = listener.mock.calls[0][0];
  expect(payload.board).toBeDefined();
  expect(payload.currentPlayer).toBeDefined();
  expect(payload.gameStatus).toBeDefined();
});

test("STATE_CHANGE event fires on reset", () => {
  const game = new Game();
  game.savePlayerMove(0);
  const listener = vi.fn();
  game.on(GameEvent.STATE_CHANGE, listener);
  game.reset();
  expect(listener).toHaveBeenCalledOnce();
});

test("STATE_CHANGE event fires on backToMove", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.savePlayerMove(1);
  const listener = vi.fn();
  game.on(GameEvent.STATE_CHANGE, listener);
  game.backToMove(1);
  expect(listener).toHaveBeenCalledOnce();
});

test("RESET event does not fire on savePlayerMove", () => {
  const game = new Game();
  const listener = vi.fn();
  game.on(GameEvent.RESET, listener);
  game.savePlayerMove(0);
  expect(listener).not.toHaveBeenCalled();
});

test("RESET event does not fire on backToMove", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.savePlayerMove(1);
  const listener = vi.fn();
  game.on(GameEvent.RESET, listener);
  game.backToMove(1);
  expect(listener).not.toHaveBeenCalled();
});

test("PLAYER_MOVE event does not fire after game is won", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.savePlayerMove(3);
  game.savePlayerMove(1);
  game.savePlayerMove(4);
  game.savePlayerMove(2);
  expect(game.gameStatus.status).toBe("win");
  const listener = vi.fn();
  game.on(GameEvent.PLAYER_MOVE, listener);
  game.savePlayerMove(8);
  expect(listener).not.toHaveBeenCalled();
});

test("snapshot reference is stable between moves", () => {
  const game = new Game();
  const before = game.snapshot;
  const again = game.snapshot;
  expect(before).toBe(again);
});

test("snapshot reference changes after a move", () => {
  const game = new Game();
  const before = game.snapshot;
  game.savePlayerMove(0);
  expect(game.snapshot).not.toBe(before);
});

test("_gameStatus reference is preserved when game stays running", () => {
  const game = new Game();
  game.savePlayerMove(0);
  const statusAfterFirst = game.gameStatus;
  game.savePlayerMove(1);
  expect(game.gameStatus).toBe(statusAfterFirst);
});

test("deprecated boardSize rejects arbitrary board sizes", () => {
  expect(() => new Game({ boardSize: 4 })).toThrow(
    "arbitrary board sizes are not supported",
  );
});
