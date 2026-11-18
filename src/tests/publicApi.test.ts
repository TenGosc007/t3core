import type { AIInput, BoardSnapshot, GameStatus, PlayerSymbol } from "@/index";

import { expect, expectTypeOf, test } from "vitest";

import * as core from "@/index";
import { AIProviderError, TicTacToe } from "@/index";

test("the public runtime API consists only of the facade and provider error", () => {
  expect(Object.keys(core).sort()).toEqual(["AIProviderError", "TicTacToe"]);
  expect(new AIProviderError("ai_timeout", "Budget exhausted").code).toBe("ai_timeout");
  expect(TicTacToe.getCapabilities().variant.id).toBe("classic-3x3");
});

test("public domain contracts share fixed symbols and immutable data", () => {
  expectTypeOf<PlayerSymbol>().toEqualTypeOf<"O" | "X">();
  expectTypeOf<AIInput["board"]>().toEqualTypeOf<BoardSnapshot>();
  expectTypeOf<AIInput["gameStatus"]>().toEqualTypeOf<GameStatus>();
  const game = new TicTacToe({ mode: "pvp" });
  expect("reset" in game).toBe(false);
  expectTypeOf(game.currentPlayer).toEqualTypeOf<PlayerSymbol>();
  expectTypeOf(game.board).toEqualTypeOf<BoardSnapshot>();
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
