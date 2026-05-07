import { expect, test } from "vitest";

import { Game } from "../Game";

/*
    O   X   O
    O   X   X
    X   O   O
*/
test("Check if the game ends in a draw", () => {
  const game = new Game();

  game.savePlayerSelection(1);
  game.savePlayerSelection(2);
  game.savePlayerSelection(3);
  game.savePlayerSelection(5);
  game.savePlayerSelection(4);
  game.savePlayerSelection(6);
  game.savePlayerSelection(8);
  game.savePlayerSelection(7);
  game.savePlayerSelection(9);

  expect(game.gameStatus).toEqual({ status: "draw" });
});

test("Reset the game", () => {
  const game = new Game();
  game.savePlayerSelection(5);
  game.savePlayerSelection(1);
  game.savePlayerSelection(2);
  game.savePlayerSelection(3);
  game.savePlayerSelection(8);
  game.reset();

  expect(game.getBoard()).toEqual(
    new Array(9).fill(0).map((_, idx) => idx + 1),
  );
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
  game.savePlayerSelection(5);
  game.savePlayerSelection(1);
  game.savePlayerSelection(2);
  game.savePlayerSelection(3);
  game.savePlayerSelection(8);

  expect(game.gameStatus).toEqual({ status: "win", winner: "O" });
  expect(game.isFieldSelected(5)).toBe(true);
  expect(game.isFieldSelected(9)).toBe(false);
});
