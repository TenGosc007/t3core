import { expect, test, vi } from "vitest";

import { Game } from "../Game";
import { GameEvent } from "../types/Game";

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
  expect(payload.board[4]).toBe("O");
  expect(payload.currentPlayer).toBe("X");
  expect(payload.gameStatus).toEqual({ status: "running" });
});

test("RESET event fires with correct payload", () => {
  const game = new Game();
  game.savePlayerMove(0);
  game.savePlayerMove(1);

  const listener = vi.fn();
  game.on(GameEvent.RESET, listener);
  game.reset();

  expect(listener).toHaveBeenCalledOnce();
  const payload = listener.mock.calls[0][0];
  expect(payload.board).toEqual(new Array(9).fill(0).map((_, idx) => idx + 1));
  expect(payload.currentPlayer).toBe("O");
  expect(payload.gameStatus).toEqual({ status: "running" });
});

test("PLAYER_MOVE event is not fired when move is invalid", () => {
  const game = new Game();
  game.savePlayerMove(0);
  const listener = vi.fn();
  game.on(GameEvent.PLAYER_MOVE, listener);

  game.savePlayerMove(0);

  expect(listener).not.toHaveBeenCalled();
});
