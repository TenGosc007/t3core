import type { SessionSnapshot } from "@/index";

import { expect, test, vi } from "vitest";

import { TicTacToe } from "@/index";

const factories = [
  () => new TicTacToe({ mode: "pvp" }),
  () =>
    new TicTacToe({
      mode: "singleplayer",
      ai: { engine: "random", seed: 1 },
    }),
  () =>
    new TicTacToe({
      mode: "aivsai",
      aiPlayers: [{ seed: 1 }, { seed: 2 }],
    }),
];

for (const createGame of factories) {
  const mode = createGame().mode;

  test(`${mode} exposes a stable bound subscribe function and snapshot`, () => {
    const game = createGame();
    const { subscribe, getSnapshot } = game;
    const snapshot = game.snapshot;
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    expect(game.subscribe).toBe(subscribe);
    expect(game.getSnapshot).toBe(getSnapshot);
    expect(getSnapshot()).toBe(snapshot);
    expect(game.snapshot).toBe(snapshot);
    expect(listener).not.toHaveBeenCalled();

    game.reset();
    expect(listener).toHaveBeenCalledExactlyOnceWith();
    expect(game.snapshot).not.toBe(snapshot);
    expect(game.snapshot).toBe(game.snapshot);

    unsubscribe();
    unsubscribe();
    game.reset();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test(`${mode} notifies subscribers after a move and reset`, async () => {
    const game = createGame();
    const snapshots: SessionSnapshot[] = [];
    const unsubscribe = game.subscribe(() => snapshots.push(game.snapshot));

    if (game.mode === "aivsai") {
      await game.step();
    } else {
      await game.start();
      expect(snapshots.map((state) => state.phase)).toEqual(["human-turn"]);
      await game.playMove(4);
    }

    expect(snapshots.length).toBe(game.movesCount + 1);
    expect(snapshots[snapshots.length - 1]).toBe(game.snapshot);
    expect(
      snapshots[1]?.board.filter((field) => typeof field === "string"),
    ).toHaveLength(1);
    const movesCount = game.movesCount;

    game.reset();
    expect(snapshots).toHaveLength(movesCount + 2);
    expect(snapshots[snapshots.length - 1]).toBe(game.snapshot);
    expect(game.snapshot.board).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(game.snapshot.currentPlayer).toBe("O");
    expect(game.snapshot.gameStatus).toEqual({ status: "running" });
    unsubscribe();
  });

  test(`${mode} aborts stale moves if a subscriber resets the game`, async () => {
    const game = createGame();
    const moves = vi.fn();
    game.on("move", moves);
    if (game.mode !== "aivsai") await game.start();
    const unsubscribe = game.subscribe(() => {
      unsubscribe();
      game.reset();
    });

    const result =
      game.mode === "aivsai" ? await game.step() : await game.playMove(4);

    expect(result).toEqual({ status: "aborted" });
    expect(moves).not.toHaveBeenCalled();
    expect(game.movesCount).toBe(0);
  });
}

test("each subscription has independent, idempotent cleanup", () => {
  const game = new TicTacToe({ mode: "pvp" });
  const listener = vi.fn();
  const otherListener = vi.fn();
  const unsubscribe = game.subscribe(listener);
  const unsubscribeAgain = game.subscribe(listener);
  const unsubscribeOther = game.subscribe(otherListener);

  game.reset();
  expect(listener).toHaveBeenCalledTimes(2);
  expect(otherListener).toHaveBeenCalledTimes(1);

  unsubscribe();
  unsubscribe();
  game.reset();
  expect(listener).toHaveBeenCalledTimes(3);
  expect(otherListener).toHaveBeenCalledTimes(2);

  unsubscribeAgain();
  const unsubscribeNew = game.subscribe(listener);
  unsubscribeAgain();
  game.reset();
  expect(listener).toHaveBeenCalledTimes(4);
  expect(otherListener).toHaveBeenCalledTimes(3);

  unsubscribeNew();
  unsubscribeOther();
  game.reset();
  expect(listener).toHaveBeenCalledTimes(4);
  expect(otherListener).toHaveBeenCalledTimes(3);
});

test("invalid or rejected moves do not notify or replace the snapshot", async () => {
  const game = new TicTacToe({ mode: "pvp" });
  const listener = vi.fn();
  game.subscribe(listener);
  await game.start();
  await game.playMove(4);
  listener.mockClear();
  const snapshot = game.snapshot;

  expect(await game.playMove(4)).toEqual({ status: "rejected", reason: "already_selected" });
  expect(await game.playMove(-1)).toEqual({ status: "rejected", reason: "invalid_index" });
  expect(listener).not.toHaveBeenCalled();
  expect(game.snapshot).toBe(snapshot);
});

test("singleplayer subscribers observe the human move before the AI reply", async () => {
  const game = new TicTacToe({
    mode: "singleplayer",
    ai: { seed: 1 },
  });
  const snapshots: SessionSnapshot[] = [];
  game.subscribe(() => snapshots.push(game.snapshot));
  await game.start();
  snapshots.length = 0;

  const pending = game.playMove(4);
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0]?.board[4]).toBe("O");
  expect(snapshots[0]?.currentPlayer).toBe("X");

  await pending;
  expect(snapshots).toHaveLength(2);
  expect(snapshots[1]).toBe(game.snapshot);
  expect(snapshots[1]?.currentPlayer).toBe("O");
  expect(
    snapshots[0]?.board.filter((field) => typeof field === "string"),
  ).toHaveLength(1);
});

test("aivsai subscribers observe every move including the terminal snapshot", async () => {
  const game = new TicTacToe({
    mode: "aivsai",
    aiPlayers: [{ seed: 1 }, { seed: 2 }],
  });
  const snapshots: SessionSnapshot[] = [];
  game.subscribe(() => snapshots.push(game.snapshot));

  await game.run();

  expect(snapshots).toHaveLength(game.movesCount + 1);
  expect(snapshots[snapshots.length - 1]).toBe(game.snapshot);
  expect(game.snapshot.gameStatus.status).not.toBe("running");
});

test("effect setup, cleanup and setup abort the old AI opening without stale updates", async () => {
  const game = new TicTacToe({
    mode: "singleplayer",
    humanSymbol: "X",
    ai: { seed: 1 },
  });
  const firstListener = vi.fn();
  const unsubscribe = game.subscribe(firstListener);
  const firstStart = game.start();

  unsubscribe();
  game.reset();

  const snapshots: SessionSnapshot[] = [];
  const unsubscribeAgain = game.subscribe(() => snapshots.push(game.snapshot));
  const secondStart = game.start();

  expect(await firstStart).toEqual({ status: "aborted" });
  expect(await secondStart).toEqual({ status: "success", value: undefined });
  expect(firstListener).toHaveBeenCalledTimes(1);
  expect(snapshots.map((state) => state.phase)).toEqual(["ai-thinking", "human-turn"]);
  expect(snapshots[1]).toBe(game.snapshot);
  expect(game.movesCount).toBe(1);

  unsubscribeAgain();
  game.reset();
  expect(snapshots).toHaveLength(2);
});
