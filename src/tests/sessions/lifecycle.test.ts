import type { SessionSnapshot } from "@/index";

import { expect, test, vi } from "vitest";

import { Game, PvPGame, TicTacToe } from "@/index";

import { deferredStrategy, makeAI, makeSingle, success } from "./lifecycle.helpers";

test("start is idempotent in an active or finished PvP game, and stop/start resumes", async () => {
  const session = new PvPGame({ game: new Game() });
  const changed = vi.fn();
  const turn = vi.fn();
  session.subscribe(changed);
  session.on("turn", turn);
  const initial = session.snapshot;
  expect(session.stop()).toEqual(success);
  expect(session.snapshot).toBe(initial);
  await session.start();
  const active = session.snapshot;
  expect(await session.start()).toEqual(success);
  expect(session.snapshot).toBe(active);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(turn).toHaveBeenCalledTimes(1);

  expect(session.stop()).toEqual(success);
  const paused = session.snapshot;
  expect(paused.phase).toBe("paused");
  expect(session.stop()).toEqual(success);
  expect(session.snapshot).toBe(paused);
  expect(await session.playMove(4)).toEqual({ status: "rejected", reason: "paused" });
  expect(await session.start()).toEqual(success);
  for (const move of [0, 3, 1, 4, 2]) await session.playMove(move);
  const finished = session.snapshot;
  expect(await session.start()).toEqual(success);
  expect(session.stop()).toEqual(success);
  expect(session.snapshot).toBe(finished);
  expect(await session.playMove(8)).toEqual({ status: "rejected", reason: "game_finished" });
});

test("repeated start during AI opening is busy, then becomes a no-op on the human turn", async () => {
  const slow = deferredStrategy();
  const session = makeSingle(slow.strategy, "X");
  const opening = session.start();
  expect(await session.start()).toEqual({ status: "rejected", reason: "busy" });
  expect(slow.calculateMove).toHaveBeenCalledTimes(1);
  slow.resolve(4);
  expect(await opening).toEqual(success);
  const state = session.snapshot;
  expect(await session.start()).toEqual(success);
  expect(session.snapshot).toBe(state);
  expect(slow.calculateMove).toHaveBeenCalledTimes(1);
});

for (const mode of ["pvp", "singleplayer", "aivsai"] as const) {
  test(`the ${mode} facade supports restart, stop, undo and final disposal`, async () => {
    const game = mode === "pvp" ? new TicTacToe({ mode })
      : mode === "singleplayer" ? new TicTacToe({ mode, ai: { seed: 1 } })
        : new TicTacToe({ mode, aiPlayers: [{ seed: 1 }, { seed: 2 }] });
    const states: SessionSnapshot[] = [];
    const changed = vi.fn(() => states.push(game.getSnapshot()));
    game.subscribe(changed);

    expect(await game.restart()).toEqual(success);
    expect(game.snapshot.phase).toBe(mode === "aivsai" ? "ai-ready" : "human-turn");
    if (game.mode === "aivsai") await game.step();
    else await game.playMove(4);
    expect(game.undo()).toEqual(success);
    expect(game.movesCount).toBe(0);
    game.stop();
    expect(game.snapshot.phase).toBe("paused");
    const board = game.board;
    expect(await game.restart()).toEqual(success);
    expect(game.board).not.toBe(board);
    expect(game.movesCount).toBe(0);
    expect(game.snapshot.phase).toBe(mode === "aivsai" ? "ai-ready" : "human-turn");

    game.dispose();
    expect(states[states.length - 1]?.phase).toBe("disposed");
    expect(game.snapshot).toMatchObject({ phase: "disposed", canPlay: false, canUndo: false });
    const disposed = game.getSnapshot();
    const count = changed.mock.calls.length;
    const late = vi.fn();
    game.subscribe(late)();
    game.on("turn", late);
    expect(await game.restart()).toEqual({ status: "rejected", reason: "disposed" });
    expect(game.stop()).toEqual({ status: "rejected", reason: "disposed" });
    expect(game.undo()).toEqual({ status: "rejected", reason: "disposed" });
    if (game.mode === "aivsai") {
      expect(await game.step()).toEqual({ status: "rejected", reason: "disposed" });
      expect(await game.run()).toEqual({ status: "rejected", reason: "disposed" });
    } else {
      expect(await game.start()).toEqual({ status: "rejected", reason: "disposed" });
      expect(await game.playMove(0)).toEqual({ status: "rejected", reason: "disposed" });
    }
    game.reset(); // The transitional void method is a no-op after disposal.
    game.dispose();
    expect(game.getSnapshot()).toBe(disposed);
    expect(changed).toHaveBeenCalledTimes(count);
    expect(late).not.toHaveBeenCalled();
  });
}

test("restart automatically performs the AI opening when the human plays X", async () => {
  const slow = deferredStrategy();
  const session = makeSingle(slow.strategy, "X");
  const states: string[] = [];
  session.subscribe(() => states.push(session.snapshot.phase));
  const restarted = session.restart();
  expect(session.snapshot.phase).toBe("ai-thinking");
  expect(slow.calculateMove).toHaveBeenCalledTimes(1);
  expect(states).toEqual(["idle", "ai-thinking"]);
  slow.resolve(4);
  expect(await restarted).toEqual(success);
  expect(session.snapshot).toMatchObject({ phase: "human-turn", currentPlayer: "X", movesCount: 1 });
});

test("an AI error is returned as data, blocks retries and survives stop until restart", async () => {
  let calls = 0;
  const session = makeSingle({ calculateMove: async () => {
    if (++calls === 1) throw new Error("AI failure");
    return 4;
  } }, "X");
  expect(await session.start()).toMatchObject({
    status: "error", error: { code: "ai_failed", message: "AI failure" },
  });
  const failed = session.snapshot;
  expect(await session.start()).toEqual({ status: "rejected", reason: "session_error" });
  expect(await session.playMove(0)).toEqual({ status: "rejected", reason: "session_error" });
  expect(session.stop()).toEqual(success);
  expect(session.snapshot).toBe(failed);
  expect(calls).toBe(1);
  expect(await session.restart()).toEqual(success);
  expect(session.snapshot).toMatchObject({ phase: "human-turn", error: null });
});

test("AI-vs-AI completion is a terminal value and repeating run neither moves nor notifies", async () => {
  const session = makeAI();
  const result = await session.run();
  expect(result).toMatchObject({ status: "success", value: { status: "win", winner: "O" } });
  const finished = session.snapshot;
  const changed = vi.fn();
  session.subscribe(changed);
  expect(await session.run()).toEqual(result);
  expect(await session.step()).toEqual({ status: "rejected", reason: "game_finished" });
  expect(session.snapshot).toBe(finished);
  expect(changed).not.toHaveBeenCalled();
  session.dispose();
  expect(session.snapshot.gameStatus).toBe(finished.gameStatus);
  expect(session.snapshot.board).toBe(finished.board);
});

test("disposing from the first gameplay listener prevents stale delivery to later listeners", async () => {
  const session = new PvPGame({ game: new Game() });
  await session.start();
  session.on("move", () => session.dispose());
  const later = vi.fn();
  session.on("move", later);
  session.on("turn", later);
  expect(await session.playMove(0)).toEqual({ status: "aborted" });
  expect(later).not.toHaveBeenCalled();
  expect(session.snapshot.phase).toBe("disposed");
});

test("throwing disposal callbacks still leave a closed instance with subscriptions removed", async () => {
  const session = makeSingle();
  await session.start();
  const error = new Error("Application disposal callback");
  session.subscribe(() => { throw error; });
  expect(() => session.dispose()).toThrow(error);
  expect(session.snapshot.phase).toBe("disposed");
  expect(() => session.dispose()).not.toThrow();
  expect(await session.restart()).toEqual({ status: "rejected", reason: "disposed" });
});

test("disposal preserves a frozen serializable error without keeping its listeners", async () => {
  const session = makeAI({ calculateMove: async () => { throw new Error("AI"); } });
  await session.step();
  const failed = session.snapshot;
  const changed = vi.fn();
  session.subscribe(changed);
  session.dispose();
  expect(session.snapshot.error).toEqual(failed.error);
  expect(Object.isFrozen(session.snapshot.error)).toBe(true);
  expect(changed).toHaveBeenCalledTimes(1);
});

test("AI-vs-AI refuses both entry points while in error", async () => {
  const calculateMove = vi.fn(async () => -1);
  const session = makeAI({ calculateMove });
  await session.step();
  expect(await session.step()).toEqual({ status: "rejected", reason: "session_error" });
  expect(await session.run()).toEqual({ status: "rejected", reason: "session_error" });
  expect(calculateMove).toHaveBeenCalledTimes(1);
});

test("disposing a drawn game preserves its terminal result and board references", async () => {
  const session = new PvPGame({ game: new Game() });
  await session.start();
  for (const move of [0, 1, 2, 4, 3, 5, 7, 6, 8]) await session.playMove(move);
  const drawn = session.snapshot;
  expect(drawn.gameStatus.status).toBe("draw");
  session.dispose();
  expect(session.snapshot.phase).toBe("disposed");
  expect(session.snapshot.board).toBe(drawn.board);
  expect(session.snapshot.gameStatus).toBe(drawn.gameStatus);
});
