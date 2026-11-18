import type * as Strategies from "@/strategies";

import { expect, test, vi } from "vitest";

import { Game, PlayerMoveStatus, PvPGame, SinglePlayerGame } from "@/index";

vi.mock("@/strategies", async (importOriginal) => {
  const original = await importOriginal<typeof Strategies>();
  const classic = original.resolveGameStrategy({});
  // A test-only restriction proves both human and AI input consult variant rules.
  const rules = Object.freeze({
    ...classic,
    isLegalMove: (...args: Parameters<typeof classic.isLegalMove>) =>
      args[1] !== 4 && classic.isLegalMove(...args),
    getLegalMoves: (...args: Parameters<typeof classic.getLegalMoves>) =>
      Object.freeze(classic.getLegalMoves(...args).filter((index) => index !== 4)),
  });
  return { ...original, resolveGameStrategy: () => rules };
});

test("human and AI moves share the rule-validation gate, including variant restrictions", async () => {
  const humanGame = new Game();
  const human = new PvPGame({ game: humanGame });
  await human.start();
  const snapshot = human.snapshot;
  expect(humanGame.validateMove(4)).toBe(PlayerMoveStatus.ILLEGAL_MOVE);
  expect(await human.playMove(4)).toEqual({ status: "rejected", reason: "illegal_move" });
  expect(human.snapshot).toBe(snapshot);
  expect(human.snapshot.legalMoves).not.toContain(4);
  expect(humanGame.isLegalMove(4)).toBe(false);
  expect(humanGame.isLegalMove(0)).toBe(true);

  const ai = new SinglePlayerGame({
    game: new Game(), humanSymbol: "X", aiSymbol: "O",
    strategy: { calculateMove: async () => 4 },
  });
  expect(await ai.start()).toMatchObject({
    status: "error", error: { code: "illegal_ai_move" },
  });
  expect(ai.movesCount).toBe(0);
  expect(ai.board[4]).toBe(5);
});

test("metadata and legal moves come from rules, while history restoration recomputes the result", () => {
  const game = new Game();
  expect(game.variant).toEqual({
    id: "classic-3x3", rows: 3, columns: 3, winLength: 3, lineRule: "at-least",
  });
  expect(Object.isFrozen(game.rules)).toBe(true);
  expect(Object.isFrozen(game.variant)).toBe(true);
  expect(Object.isFrozen(game.getLegalMoves())).toBe(true);
  for (const move of [0, 3, 1, 5, 2]) game.savePlayerMove(move);
  expect(game.gameStatus).toEqual({ status: "win", winner: "O" });
  expect(game.getLegalMoves()).toEqual([]);
  game.backToMove(4);
  expect(game.gameStatus).toEqual({ status: "running" });
  expect(game.getLegalMoves()).toContain(2);
  expect(game.getLegalMoves()).not.toContain(4);
});
