import type { MoveStrategy } from "../../ai/strategy.types";

import { expect, test } from "vitest";

import { AlphaBetaStrategy } from "../../ai/AlphaBetaStrategy";
import { MoveStrategyError } from "../../ai/strategy.types";
import { AIDifficulty } from "../../ai/types";
import { Game } from "../../game/Game";
import { SinglePlayerGame } from "../../sessions/SinglePlayerGame";

// --- Helpers (deduplicate session construction across tests) ---

/** Set by `slowSession()`'s strategy; call it to resolve the pending AI move. */
let resolveSlowMove!: (value: number) => void;

/** Builds a SinglePlayerGame whose AI blocks until `resolveSlowMove(n)` is called. */
function slowSession(humanSymbol: "O" | "X" = "O"): {
  game: Game;
  session: SinglePlayerGame;
} {
  const game = new Game();
  const slowStrategy: MoveStrategy = {
    calculateMove: () =>
      new Promise<number>((resolve) => {
        resolveSlowMove = resolve;
      }),
  };
  const aiSymbol = humanSymbol === "O" ? "X" : "O";
  return {
    game,
    session: new SinglePlayerGame({
      game,
      strategy: slowStrategy,
      humanSymbol,
      aiSymbol,
    }),
  };
}

/** Builds a SinglePlayerGame with an AlphaBetaStrategy (HARD, seed=1). */
function hardSession(humanSymbol: "O" | "X" = "O"): {
  game: Game;
  session: SinglePlayerGame;
} {
  const game = new Game();
  const strategy = new AlphaBetaStrategy({
    difficulty: AIDifficulty.HARD,
    seed: 1,
  });
  const aiSymbol = humanSymbol === "O" ? "X" : "O";
  return {
    game,
    session: new SinglePlayerGame({ game, strategy, humanSymbol, aiSymbol }),
  };
}

/** Builds a SinglePlayerGame with a custom stub strategy. */
function stubSession(
  strategy: MoveStrategy,
  humanSymbol: "O" | "X" = "O",
): { game: Game; session: SinglePlayerGame } {
  const game = new Game();
  const aiSymbol = humanSymbol === "O" ? "X" : "O";
  return {
    game,
    session: new SinglePlayerGame({ game, strategy, humanSymbol, aiSymbol }),
  };
}

// --- Tests ---

test("human starts: start() emits turn for the human, no AI move", async () => {
  const { session } = hardSession("O");

  const events: string[] = [];
  session.on("turn", ({ player }) => events.push(`turn:${player}`));
  session.on("move", ({ player, position }) =>
    events.push(`move:${player}:${position}`),
  );
  session.on("ai-thinking", () => events.push("ai-thinking"));

  await session.start();
  expect(events).toEqual(["turn:O"]);
});

test("AI starts: start() emits ai-thinking, move, turn (for human)", async () => {
  const { session } = hardSession("X");

  const events: string[] = [];
  session.on("turn", ({ player }) => events.push(`turn:${player}`));
  session.on("move", ({ player, position }) =>
    events.push(`move:${player}:${position}`),
  );
  session.on("ai-thinking", ({ player }) =>
    events.push(`ai-thinking:${player}`),
  );

  await session.start();
  expect(events[0]).toBe("ai-thinking:O");
  expect(events[1]).toMatch(/^move:O:\d+$/);
  expect(events[2]).toBe("turn:X");
});

test("playMove emits move(human), ai-thinking, move(AI), turn(human)", async () => {
  const { session } = hardSession("O");
  await session.start();

  const events: string[] = [];
  session.on("turn", ({ player }) => events.push(`turn:${player}`));
  session.on("move", ({ player, position }) =>
    events.push(`move:${player}:${position}`),
  );
  session.on("ai-thinking", ({ player }) =>
    events.push(`ai-thinking:${player}`),
  );

  await session.playMove(4);
  expect(events).toEqual([
    "move:O:4",
    "ai-thinking:X",
    expect.stringMatching(/^move:X:\d+$/),
    "turn:O",
  ]);
});

test("invalid human move does not trigger AI", async () => {
  const { session } = hardSession("O");
  await session.start();

  let aiThinking = false;
  session.on("ai-thinking", () => {
    aiThinking = true;
  });

  const result = await session.playMove(99);
  expect(result.status).toBe("invalid_index");
  expect(aiThinking).toBe(false);
});

test("already-selected field does not trigger AI", async () => {
  const { session } = hardSession("O");
  await session.start();
  await session.playMove(0);

  let aiThinking = false;
  session.on("ai-thinking", () => {
    aiThinking = true;
  });

  const result = await session.playMove(0);
  expect(result.status).toBe("already_selected");
  expect(aiThinking).toBe(false);
});

test("playMove before start() returns game_not_running", async () => {
  const { session } = hardSession("O");
  const result = await session.playMove(0);
  expect(result.status).toBe("game_not_running");
});

test("game ends after human win: emits finished, no AI move", async () => {
  // Stub strategy plays predictable non-blocking moves so the human wins row 0,1,2.
  const movesByAi: number[] = [5, 6];
  let callIdx = 0;
  const stubStrategy: MoveStrategy = {
    calculateMove: async () => movesByAi[callIdx++] as number,
  };
  const { game, session } = stubSession(stubStrategy, "O");
  await session.start();

  let aiThinkingAfterFinish = false;
  let finishedFired = false;
  session.on("finished", () => {
    finishedFired = true;
  });
  session.on("ai-thinking", () => {
    if (finishedFired) aiThinkingAfterFinish = true;
  });

  // O:0, AI:5, O:1, AI:6, O:2 → O wins row 0,1,2.
  await session.playMove(0);
  await session.playMove(1);
  const result = await session.playMove(2);
  expect(result.status).toBe("success");
  expect(finishedFired).toBe(true);
  expect(aiThinkingAfterFinish).toBe(false);
  expect(game.gameStatus.status).toBe("win");
  if (game.gameStatus.status === "win") {
    expect(game.gameStatus.winner).toBe("O");
  }
});

test("reset() during AI computation aborts the in-flight playMove", async () => {
  const { game, session } = slowSession("O");
  await session.start();

  const playPromise = session.playMove(0); // human moves, then AI "thinks"
  session.reset(); // reset while AI is "thinking"
  resolveSlowMove(4); // AI "chooses" 4 — but generation changed, must abort

  const result = await playPromise;
  expect(result.status).toBe("aborted");
  expect(game.board.every((f) => typeof f !== "string")).toBe(true);
});

test("second playMove during AI computation returns busy", async () => {
  const { session } = slowSession("O");
  await session.start();

  const playPromise = session.playMove(0);
  const result2 = await session.playMove(1);
  expect(result2.status).toBe("busy");

  resolveSlowMove(4);
  await playPromise;
});

test("strategy returning an illegal move throws MoveStrategyError", async () => {
  // Strategy always returns 0 — after the human plays 0, the AI "chooses" 0
  // which is now occupied → illegal_move.
  const badStrategy: MoveStrategy = {
    calculateMove: async () => 0,
  };
  const { session } = stubSession(badStrategy, "O");
  await session.start();
  await expect(session.playMove(0)).rejects.toMatchObject({
    code: "illegal_move",
    name: "MoveStrategyError",
  });
});

test("strategy throwing no_legal_moves results in finished event", async () => {
  const noMovesStrategy: MoveStrategy = {
    calculateMove: async () => {
      throw new MoveStrategyError("no_legal_moves", "test");
    },
  };
  const { session } = stubSession(noMovesStrategy, "O");
  await session.start();

  let finished = false;
  session.on("finished", () => {
    finished = true;
  });

  await session.playMove(0); // human moves, then AI "throws no_legal_moves"
  expect(finished).toBe(true);
});
