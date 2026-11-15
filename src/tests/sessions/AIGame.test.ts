import type { MoveStrategy } from "@/ai";

import { expect, test } from "vitest";

import { AlphaBetaStrategy } from "@/ai";
import { AIDifficulty } from "@/ai/difficulty";
import { Game } from "@/game/Game";
import { AIGame } from "@/sessions/AIGame";

// Helpers build the mutable tuple type expected by AIGame, and deduplicate
// the repeated strategy-pair construction (fallow duplication warning).
function hardVsNormal(): [MoveStrategy, MoveStrategy] {
  return [
    new AlphaBetaStrategy({ difficulty: AIDifficulty.HARD, seed: 1 }),
    new AlphaBetaStrategy({ difficulty: AIDifficulty.NORMAL, seed: 2 }),
  ];
}
function hardVsHard(): [MoveStrategy, MoveStrategy] {
  return [
    new AlphaBetaStrategy({ difficulty: AIDifficulty.HARD, seed: 1 }),
    new AlphaBetaStrategy({ difficulty: AIDifficulty.HARD, seed: 2 }),
  ];
}

/** Set by `slowFirstPlayer()`'s strategy; call it to resolve the pending move. */
let resolveSlowMove!: (value: number) => void;

/** Builds a strategy pair whose first member blocks until `resolveSlowMove(n)` is called. */
function slowFirstPlayer(): [MoveStrategy, MoveStrategy] {
  return [
    {
      calculateMove: () =>
        new Promise<number>((resolve) => {
          resolveSlowMove = resolve;
        }),
    },
    new AlphaBetaStrategy({ difficulty: AIDifficulty.HARD, seed: 2 }),
  ];
}

test("run() plays a full game and reaches a terminal state", async () => {
  const game = new Game();
  const strategies = hardVsNormal();
  const session = new AIGame({ game, strategies });

  const result = await session.run();
  expect(result.status).toBe("completed");
  if (result.status === "completed") {
    expect(["win", "draw"]).toContain(result.result.status);
  }
});

test("run() emits move events for each move and a single finished", async () => {
  const game = new Game();
  const strategies = hardVsHard();
  const session = new AIGame({ game, strategies });

  const moves: string[] = [];
  let finishedCount = 0;
  session.on("move", ({ player, position }) =>
    moves.push(`${player}:${position}`),
  );
  session.on("finished", () => {
    finishedCount++;
  });

  await session.run();
  // At least 5 moves on 3x3 (min for a win), max 9.
  expect(moves.length).toBeGreaterThanOrEqual(5);
  expect(moves.length).toBeLessThanOrEqual(9);
  expect(finishedCount).toBe(1);
});

test("step() performs a single AI move", async () => {
  const game = new Game();
  const strategies = hardVsHard();
  const session = new AIGame({ game, strategies });

  const result = await session.step();
  expect(result.status).toBe("success");
  expect(game.movesCount).toBe(1);
});

test("reset() allows a new run()", async () => {
  const game = new Game();
  const strategies = hardVsHard();
  const session = new AIGame({ game, strategies });

  await session.run();
  expect(game.gameStatus.status).not.toBe("running");

  session.reset();
  expect(game.gameStatus.status).toBe("running");
  expect(game.movesCount).toBe(0);

  const result = await session.run();
  expect(result.status).toBe("completed");
});

test("second step() while one is in flight returns busy", async () => {
  const game = new Game();
  const strategies = slowFirstPlayer();
  const session = new AIGame({ game, strategies });

  const stepPromise = session.step();
  const result2 = await session.step();
  expect(result2.status).toBe("busy");

  resolveSlowMove(4);
  await stepPromise;
});

test("reset() during run() aborts and clears the board", async () => {
  const game = new Game();
  const strategies = slowFirstPlayer();
  const session = new AIGame({ game, strategies });

  const runPromise = session.run();
  session.reset();
  resolveSlowMove(4);

  const result = await runPromise;
  expect(result.status).toBe("aborted");
  expect(game.board.every((f) => typeof f !== "string")).toBe(true);
});
