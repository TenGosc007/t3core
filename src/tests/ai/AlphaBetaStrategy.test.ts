import type { MoveContext } from "../../ai/strategy.types";

import { expect, test } from "vitest";

import { AlphaBetaStrategy } from "../../ai/AlphaBetaStrategy";
import { AIDifficulty } from "../../ai/types";
import { Game } from "../../game/Game";

function ctx(aiSymbol: "O" | "X" = "X"): MoveContext {
  return {
    aiSymbol,
    opponentSymbol: aiSymbol === "O" ? "X" : "O",
    gameStatus: { status: "running" },
  };
}

test("HARD completes a winning line when one is available", async () => {
  const game = new Game();
  // X has 4,8 (threatens 0). X to move.
  game.savePlayerMove(1); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(2); // O
  game.savePlayerMove(8); // X
  game.savePlayerMove(3); // O — now X's turn

  const strategy = new AlphaBetaStrategy({
    difficulty: AIDifficulty.HARD,
    seed: 1, // seed=1 → rng() ~= 0.27 > 0.1 mistakeRate, no mistake
  });
  const move = await strategy.calculateMove(game.board, ctx("X"));
  expect(move).toBe(0); // complete diagonal 0,4,8
});

test("HARD blocks an opponent's winning threat", async () => {
  const game = new Game();
  // O has 0,1 (threatens 2). X must block at 2.
  game.savePlayerMove(0); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(1); // O — now X's turn

  const strategy = new AlphaBetaStrategy({
    difficulty: AIDifficulty.HARD,
    seed: 1,
  });
  const move = await strategy.calculateMove(game.board, ctx("X"));
  expect(move).toBe(2);
});

test("throws MoveStrategyError('no_legal_moves') on a full board", async () => {
  // Draw position (no winner, board full):
  // O X X
  // X O O
  // O X O
  const drawBoard: (string | number)[] = [
    "O",
    "X",
    "X",
    "X",
    "O",
    "O",
    "O",
    "X",
    "O",
  ];
  const strategy = new AlphaBetaStrategy({ difficulty: AIDifficulty.HARD });
  await expect(
    strategy.calculateMove(
      drawBoard as unknown as readonly (number | string)[],
      ctx(),
    ),
  ).rejects.toMatchObject({
    code: "no_legal_moves",
    name: "MoveStrategyError",
  });
});

test("does not mutate the board snapshot", async () => {
  const game = new Game();
  game.savePlayerMove(0);
  const before = [...game.board];
  const strategy = new AlphaBetaStrategy({
    difficulty: AIDifficulty.HARD,
    seed: 1,
  });
  await strategy.calculateMove(game.board, ctx("X"));
  expect([...game.board]).toEqual(before);
});

test("persistent RNG: same seed gives a reproducible move sequence across a game", async () => {
  const playGame = async (seed: number) => {
    const game = new Game();
    const strategy = new AlphaBetaStrategy({
      difficulty: AIDifficulty.NORMAL,
      seed,
    });
    const moves: number[] = [];
    // AI plays both sides via the same strategy instance for sequence reproducibility.
    while (game.gameStatus.status === "running") {
      const player = game.currentPlayer as "O" | "X";
      const m = await strategy.calculateMove(game.board, ctx(player));
      moves.push(m);
      game.savePlayerMove(m);
    }
    return moves;
  };

  const seq1 = await playGame(123);
  const seq2 = await playGame(123);
  expect(seq1).toEqual(seq2);
});

test("throws RangeError on a non-9-cell board", async () => {
  const strategy = new AlphaBetaStrategy();
  // Pass a fake 4-cell board.
  await expect(
    strategy.calculateMove(
      [0, 1, 2, 3] as unknown as readonly (number | string)[],
      ctx(),
    ),
  ).rejects.toThrow(RangeError);
});
