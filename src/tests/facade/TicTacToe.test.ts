import { expect, test } from "vitest";

import { TicTacToe } from "@/facade/TicTacToe";

test("pvp mode returns a PvPInstance with playMove + start, no step/run", () => {
  const game = new TicTacToe({ mode: "pvp" });
  expect(game.mode).toBe("pvp");
  expect(typeof game.playMove).toBe("function");
  expect(typeof game.start).toBe("function");
  expect("step" in game).toBe(false);
  expect("run" in game).toBe(false);
});

test("singleplayer mode returns a SinglePlayerInstance", () => {
  const game = new TicTacToe({
    mode: "singleplayer",
    humanSymbol: "O",
    ai: { engine: "alphabeta", difficulty: "hard" },
  });
  expect(game.mode).toBe("singleplayer");
  expect(typeof game.playMove).toBe("function");
  expect(typeof game.start).toBe("function");
  expect("step" in game).toBe(false);
});

test("singleplayer with random engine works end-to-end", async () => {
  const game = new TicTacToe({
    mode: "singleplayer",
    humanSymbol: "O",
    ai: { engine: "random", seed: 42 },
  });
  await game.start();
  const result = await game.playMove(4);
  expect(result.status).toBe("success");
  expect(game.movesCount).toBe(2); // human + AI
});

test("aivsai mode returns an AivsAiInstance with step + run, no playMove/start", () => {
  const game = new TicTacToe({
    mode: "aivsai",
    aiPlayers: [
      { engine: "alphabeta", difficulty: "hard" },
      { engine: "alphabeta", difficulty: "normal" },
    ],
  });
  expect(game.mode).toBe("aivsai");
  expect(typeof game.step).toBe("function");
  expect(typeof game.run).toBe("function");
  expect("playMove" in game).toBe(false);
  expect("start" in game).toBe(false);
});

test("aivsai run() reaches a terminal state", async () => {
  const game = new TicTacToe({
    mode: "aivsai",
    aiPlayers: [
      { engine: "alphabeta", difficulty: "hard", seed: 1 },
      { engine: "alphabeta", difficulty: "normal", seed: 2 },
    ],
  });
  const result = await game.run();
  expect(result.status).toBe("success");
  if (result.status === "success") {
    expect(["win", "draw"]).toContain(result.value.status);
  }
});

test("pvp end-to-end: start, playMove, events", async () => {
  const game = new TicTacToe({ mode: "pvp" });
  const events: string[] = [];
  game.on("turn", ({ player }) => events.push(`turn:${player}`));
  game.on("move", ({ player, position }) =>
    events.push(`move:${player}:${position}`),
  );

  await game.start();
  expect(events).toEqual(["turn:O"]);

  await game.playMove(0);
  expect(events).toEqual(["turn:O", "move:O:0", "turn:X"]);
});

test("restart() clears the board and immediately allows a new game", async () => {
  const game = new TicTacToe({ mode: "pvp" });
  await game.start();
  await game.playMove(0);
  await game.restart();
  expect(game.movesCount).toBe(0);
  expect(game.snapshot.phase).toBe("human-turn");
  expect((await game.playMove(0)).status).toBe("success");
});

test("singleplayer AI starts: start() triggers AI move", async () => {
  const game = new TicTacToe({
    mode: "singleplayer",
    humanSymbol: "X",
    ai: { engine: "alphabeta", difficulty: "hard", seed: 1 },
  });

  const events: string[] = [];
  game.on("ai-thinking", () => events.push("ai-thinking"));
  game.on("move", ({ player }) => events.push(`move:${player}`));
  game.on("turn", ({ player }) => events.push(`turn:${player}`));

  await game.start();
  // AI moved first, then it's human's turn.
  expect(events).toContain("ai-thinking");
  expect(events.some((e) => e.startsWith("move:O"))).toBe(true);
  expect(events).toContain("turn:X");
  expect(game.movesCount).toBe(1);
});
