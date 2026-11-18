import { expect, test } from "vitest";

import { Game } from "@/game/Game";
import { PvPGame } from "@/sessions/PvPGame";

test("emits turn for player 1 ('O') after start()", async () => {
  const game = new Game();
  const session = new PvPGame({ game });

  const turns: string[] = [];
  session.on("turn", ({ player }) => turns.push(player));

  await session.start();
  expect(turns).toEqual(["O"]);
});

test("emits move + turn after a valid playMove", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  await session.start();

  const events: string[] = [];
  session.on("move", ({ player, position }) =>
    events.push(`move:${player}:${position}`),
  );
  session.on("turn", ({ player }) => events.push(`turn:${player}`));

  const result = await session.playMove(4);
  expect(result.status).toBe("success");
  expect(events).toEqual(["move:O:4", "turn:X"]);
});

test("emits finished (not turn) when a move ends the game", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  await session.start();

  // O: 0, 1, 2 — winning row.
  await session.playMove(0); // O
  await session.playMove(3); // X
  await session.playMove(1); // O
  await session.playMove(4); // X

  let finished = false;
  session.on("finished", () => {
    finished = true;
  });
  await session.playMove(2); // O wins
  expect(finished).toBe(true);
  expect(game.gameStatus.status).toBe("win");
});

test("playMove before start() returns not_started", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  const result = await session.playMove(0);
  expect(result).toEqual({ status: "rejected", reason: "not_started" });
});

test("invalid index returns invalid_index", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  await session.start();
  const result = await session.playMove(99);
  expect(result).toEqual({ status: "rejected", reason: "invalid_index" });
});

test("already-selected field returns already_selected", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  await session.start();
  await session.playMove(0);
  const result = await session.playMove(0);
  expect(result).toEqual({ status: "rejected", reason: "already_selected" });
});

test("restart() clears history and starts the next game", async () => {
  const session = new PvPGame({ game: new Game() });
  await session.start();
  await session.playMove(0);
  await session.restart();
  expect(session.movesCount).toBe(0);
  expect((await session.playMove(1)).status).toBe("success");
});

test("start() called twice is an idempotent success", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  await session.start();
  const snapshot = session.snapshot;
  expect(await session.start()).toEqual({ status: "success", value: undefined });
  expect(session.snapshot).toBe(snapshot);
});
