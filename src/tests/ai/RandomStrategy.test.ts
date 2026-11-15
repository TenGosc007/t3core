import type { MoveContext } from "@/ai";

import { expect, test } from "vitest";

import { RandomStrategy } from "@/ai";
import { Game } from "@/game/Game";

function ctx(aiSymbol: "O" | "X" = "X"): MoveContext {
  return {
    aiSymbol,
    opponentSymbol: aiSymbol === "O" ? "X" : "O",
    gameStatus: { status: "running" },
  };
}

test("returns a legal (empty) move index", async () => {
  const game = new Game();
  game.savePlayerMove(0); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(1); // O — now X's turn

  const strategy = new RandomStrategy();
  const move = await strategy.calculateMove(game.board, ctx("X"));

  expect(move).not.toBe(0);
  expect(move).not.toBe(1);
  expect(move).not.toBe(4);
  expect(move).toBeGreaterThanOrEqual(0);
  expect(move).toBeLessThan(9);
});

test("with a seed, produces a reproducible sequence across calls", async () => {
  const game1 = new Game();
  const game2 = new Game();
  const s1 = new RandomStrategy({ seed: 42 });
  const s2 = new RandomStrategy({ seed: 42 });

  const seq1: number[] = [];
  const seq2: number[] = [];

  // Drive two identical games with the same strategy seed.
  for (let i = 0; i < 5; i++) {
    const m1 = await s1.calculateMove(
      game1.board,
      ctx(game1.currentPlayer as "O" | "X"),
    );
    const m2 = await s2.calculateMove(
      game2.board,
      ctx(game2.currentPlayer as "O" | "X"),
    );
    seq1.push(m1);
    seq2.push(m2);
    game1.savePlayerMove(m1);
    game2.savePlayerMove(m2);
  }

  expect(seq1).toEqual(seq2);
});

test("throws MoveStrategyError('no_legal_moves') on a full board", async () => {
  // Use a known draw position (no winner, board full):
  // O X O
  // X X O
  // O X O  — wait, that has X at 3,4,5 = winning row. Use a real draw:
  // O X X
  // X O O
  // O X O  → fields: O,X,X,X,O,O,O,X,O — check no winner.
  // Easier: build a draw position programmatically and assert no winner.
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
  // Verify it's full.
  expect(drawBoard.every((f) => typeof f === "string")).toBe(true);

  const strategy = new RandomStrategy();
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
  const strategy = new RandomStrategy();
  await strategy.calculateMove(game.board, ctx("X"));
  expect([...game.board]).toEqual(before);
});
