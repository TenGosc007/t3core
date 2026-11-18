import { expect, test } from "vitest";

import {
  AIDifficulty,
  AlphaBetaStrategy,
  BackToMoveStatus,
  DEFAULT_GAME_SYMBOLS,
  Game,
  GameEvent,
  GameVariant,
  getBestMove,
  PlayerMoveStatus,
  RandomStrategy,
  TicTacToe,
} from "@/index";

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

test("public AI helper computes a move using exported difficulty levels", () => {
  expect(AIDifficulty.NORMAL).toBe("normal");
  expect(AIDifficulty.HARD).toBe("hard");
  expect(
    getBestMove(new Game(), {
      difficulty: AIDifficulty.HARD,
      opponentSymbol: "X",
      seed: 1,
    }),
  ).toEqual({ status: "success", index: 4 });
});

test("public strategy exports calculate legal moves", async () => {
  const game = new Game();
  for (const strategy of [
    new AlphaBetaStrategy({ difficulty: AIDifficulty.HARD, seed: 1 }),
    new RandomStrategy({ seed: 1 }),
  ]) {
    const move = await strategy.calculateMove(game.board, {
      aiSymbol: "O",
      opponentSymbol: "X",
      gameStatus: game.gameStatus,
    });
    expect(Number.isInteger(move)).toBe(true);
    expect(move).toBeGreaterThanOrEqual(0);
    expect(move).toBeLessThan(9);
    expect(typeof game.board[move]).toBe("number");
  }
});

test("public facade supports all three modes", async () => {
  const pvp = new TicTacToe({ mode: "pvp" });
  await pvp.start();
  expect(await pvp.playMove(4)).toEqual({ status: "success", value: undefined });
  expect(pvp.movesCount).toBe(1);

  const singleplayer = new TicTacToe({
    mode: "singleplayer",
    ai: { engine: "random", seed: 1 },
  });
  await singleplayer.start();
  expect(await singleplayer.playMove(4)).toEqual({ status: "success", value: undefined });
  expect(singleplayer.movesCount).toBe(2);

  const aivsai = new TicTacToe({
    mode: "aivsai",
    aiPlayers: [{ seed: 1 }, { seed: 2 }],
  });
  expect((await aivsai.run()).status).toBe("success");
  expect(["win", "draw"]).toContain(aivsai.gameStatus.status);
});
