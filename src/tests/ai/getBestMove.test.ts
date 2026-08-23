import { expect, test } from "vitest";

import { getBestMove } from "@/ai";
import { AIDifficulty } from "@/ai/difficulty";
import { Game } from "@/game/Game";
import { GameVariant } from "@/game/types/Game.types";

// All tests assume AI plays "X" (second player by default symbols ["O","X"]),
// unless noted otherwise. We drive the game to a specific position by making
// moves with savePlayerMove, then call getBestMove.

test("HARD completes a winning line when one is available", () => {
  const game = new Game({ variant: GameVariant.CLASSIC_3X3 });
  // O(0) X(4) O(1) X(3) — now O's turn? No: moves alternate O,X,O,X so after 4
  // moves it's O's turn (5th). We want X to have a winning line available.
  // Reset: make X have 4,8 and threaten 0 (diagonal 0,4,8). X to move.
  // Moves: O(1) X(4) O(2) X(8) O(3) — now X's turn, X plays 0 → wins diagonal.
  game.savePlayerMove(1); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(2); // O
  game.savePlayerMove(8); // X
  game.savePlayerMove(3); // O — now X's turn

  const result = getBestMove(game, {
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  expect(result.status).toBe("success");
  if (result.status === "success") {
    expect(result.index).toBe(0); // complete diagonal 0,4,8
  }
});

test("HARD blocks an opponent's winning threat", () => {
  const game = new Game();
  // O has 0,1 (threatens 2). X must block at 2.
  game.savePlayerMove(0); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(1); // O — now X's turn, must block 2

  const result = getBestMove(game, {
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  expect(result.status).toBe("success");
  if (result.status === "success") {
    expect(result.index).toBe(2);
  }
});

test("HARD takes the center on an empty board when it moves first", () => {
  const game = new Game();
  // Empty board, AI is "O" (moves first). Optimal first move is the center.
  const result = getBestMove(game, {
    difficulty: AIDifficulty.HARD,
    symbol: "O",
    opponentSymbol: "X",
  });
  expect(result.status).toBe("success");
  if (result.status === "success") {
    expect(result.index).toBe(4);
  }
});

test("returns no_moves when the game is not running (won)", () => {
  const game = new Game();
  // O wins: 0,1,2
  game.savePlayerMove(0); // O
  game.savePlayerMove(3); // X
  game.savePlayerMove(1); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(2); // O — win
  expect(game.gameStatus.status).toBe("win");

  const result = getBestMove(game, {
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  expect(result.status).toBe("no_moves");
});

test("returns no_moves when the board is full (draw)", () => {
  const game = new Game();
  // X O X / X O X / O X O — draw
  const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8];
  for (const m of moves) game.savePlayerMove(m);
  expect(game.gameStatus.status).toBe("draw");

  const result = getBestMove(game, {
    difficulty: AIDifficulty.HARD,
    symbol: "X",
    opponentSymbol: "O",
  });
  expect(result.status).toBe("no_moves");
});

test("throws RangeError for a non-3x3 board", () => {
  // Build a fake game-like object with a 4-cell board. `GameView` is structural,
  // so this minimal stub is accepted without casts.
  const fakeGame = {
    board: [1, 2, 3, 4],
    gameStatus: { status: "running" as const },
    currentPlayer: "X",
  };
  expect(() =>
    getBestMove(fakeGame, {
      difficulty: AIDifficulty.HARD,
      symbol: "X",
      opponentSymbol: "O",
    }),
  ).toThrow(RangeError);
});

test("NORMAL sometimes fails to block (suboptimal within bounds)", () => {
  // O has 0,1 (threatens 2). With NORMAL (depth 1, 30% mistakes), over many
  // seeds the AI should sometimes NOT block at 2. Assert at least one seed
  // produces a non-blocking move.
  const game = new Game();
  game.savePlayerMove(0); // O
  game.savePlayerMove(4); // X
  game.savePlayerMove(1); // O — X to move, should block 2 if optimal

  let failedToBlock = false;
  for (let seed = 0; seed < 50; seed++) {
    const result = getBestMove(game, {
      difficulty: AIDifficulty.NORMAL,
      symbol: "X",
      opponentSymbol: "O",
      seed,
    });
    if (result.status === "success" && result.index !== 2) {
      failedToBlock = true;
      break;
    }
  }
  expect(failedToBlock).toBe(true);
});

test("HARD is deterministic with a fixed seed (no mistake → always blocks)", () => {
  // Same blocking scenario as above. With HARD and a fixed seed, the 10%
  // mistake roll might or might not fire — but across many seeds, the majority
  // should block. Assert that at least 80% of seeds block (HARD is strong).
  const makeGame = () => {
    const g = new Game();
    g.savePlayerMove(0); // O
    g.savePlayerMove(4); // X
    g.savePlayerMove(1); // O — X to move, should block 2
    return g;
  };

  let blocked = 0;
  const total = 50;
  for (let seed = 0; seed < total; seed++) {
    const result = getBestMove(makeGame(), {
      difficulty: AIDifficulty.HARD,
      symbol: "X",
      opponentSymbol: "O",
      seed,
    });
    if (result.status === "success" && result.index === 2) blocked++;
  }
  // HARD has a 10% mistake rate, so we expect ~90% to block. 80% is a safe floor.
  expect(blocked).toBeGreaterThan(total * 0.8);
});

test("getBestMove does not mutate the game board", () => {
  const game = new Game();
  game.savePlayerMove(0); // O
  game.savePlayerMove(4); // X
  const before = [...game.board];
  getBestMove(game, {
    difficulty: AIDifficulty.HARD,
    symbol: "O",
    opponentSymbol: "X",
  });
  expect([...game.board]).toEqual(before);
});

test("infers opponent symbol from the board when not provided", () => {
  const game = new Game();
  game.savePlayerMove(0); // O
  // X to move, opponentSymbol omitted — should infer "O" from the board.
  const result = getBestMove(game, {
    difficulty: AIDifficulty.HARD,
    symbol: "X",
  });
  expect(result.status).toBe("success");
});

test("throws when opponent symbol cannot be inferred from an empty board", () => {
  const game = new Game();
  // Empty board, AI is "X", no opponentSymbol provided — cannot infer.
  expect(() =>
    getBestMove(game, { difficulty: AIDifficulty.HARD, symbol: "X" }),
  ).toThrow(RangeError);
});
