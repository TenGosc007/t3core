import { expect, test, vi } from "vitest";

import { Game } from "@/game/Game";
import { GameEvent } from "@/game/types/Game.types";
import { PvPGame } from "@/sessions/PvPGame";
import { SinglePlayerGame } from "@/sessions/SinglePlayerGame";

import { deferredStrategy, firstLegal, makeAI, makeSingle, success } from "./lifecycle.helpers";

for (const mode of ["singleplayer", "step", "run"] as const) {
  for (const action of ["stop", "restart", "dispose"] as const) {
    for (const settlement of ["resolve", "reject"] as const) {
      test(`${mode}: ${action} promptly aborts pending AI and ignores its late ${settlement}`, async () => {
        const slow = deferredStrategy();
        let calls = 0;
        const strategy = {
          calculateMove: (...args: Parameters<typeof firstLegal.calculateMove>) =>
            ++calls === 1 ? slow.strategy.calculateMove(...args) : firstLegal.calculateMove(...args),
        };
        const session = mode === "singleplayer" ? makeSingle(strategy, "X") : makeAI(strategy);
        const pending = "start" in session ? session.start()
          : mode === "step" ? session.step() : session.run();
        const changed = vi.fn();
        session.subscribe(changed);
        if (action === "stop") expect(session.stop()).toEqual(success);
        else if (action === "restart") expect(await session.restart()).toEqual(success);
        else session.dispose();

        // This settles before the deliberately unresolved provider does.
        expect(await pending).toEqual({ status: "aborted" });
        const state = session.snapshot;
        changed.mockClear();
        if (settlement === "resolve") slow.resolve(-1);
        else slow.reject(new Error("Late provider failure"));
        await Promise.resolve();
        await Promise.resolve();
        expect(session.snapshot).toBe(state);
        expect(changed).not.toHaveBeenCalled();
        expect(state.phase).toBe(action === "dispose" ? "disposed"
          : action === "stop" ? "paused"
            : mode === "singleplayer" ? "human-turn" : "ai-ready");
      });
    }
  }
}

test("stop/start/stop/start never lets an old finally release the newest AI lock", async () => {
  const first = deferredStrategy();
  const second = deferredStrategy();
  const third = deferredStrategy();
  const strategies = [first.strategy, second.strategy, third.strategy];
  let calls = 0;
  const session = makeSingle({ calculateMove: (board, context) => {
    const strategy = strategies[calls++];
    if (!strategy) throw new Error("Unexpected strategy call");
    return strategy.calculateMove(board, context);
  } }, "X");

  const opening = session.start();
  session.stop();
  const resumed = session.start();
  session.stop();
  const newest = session.start();
  expect(await opening).toEqual({ status: "aborted" });
  expect(await resumed).toEqual({ status: "aborted" });
  expect(await session.start()).toEqual({ status: "rejected", reason: "busy" });
  first.resolve(0);
  second.reject(new Error("Stale"));
  expect(await session.playMove(8)).toEqual({ status: "rejected", reason: "busy" });
  third.resolve(4);
  expect(await newest).toEqual(success);
  expect(session.snapshot).toMatchObject({ phase: "human-turn", movesCount: 1 });
  expect(session.board[4]).toBe("O");
  expect(session.board[0]).toBe(1);
});

for (const action of ["stop", "restart", "undo", "dispose"] as const) {
  test(`${action} in a thinking subscriber prevents calculation from starting`, async () => {
    const slow = deferredStrategy();
    const session = makeSingle(slow.strategy);
    await session.start();
    let handled = false;
    session.subscribe(() => {
      if (session.snapshot.phase !== "ai-thinking" || handled) return;
      handled = true;
      if (action === "restart") void session.restart();
      else session[action]();
    });
    expect(await session.playMove(0)).toEqual({ status: "aborted" });
    expect(slow.calculateMove).not.toHaveBeenCalled();
    expect(session.snapshot.phase).toBe(action === "dispose" ? "disposed"
      : action === "stop" ? "paused" : "human-turn");
  });
}

for (const action of ["stop", "undo"] as const) {
  test(`a reentrant restart makes ${action} report aborted without overwriting the new game`, async () => {
    const session = new PvPGame({ game: new Game() });
    await session.start();
    await session.playMove(0);
    let restarted: ReturnType<typeof session.restart> | undefined;
    let handled = false;
    session.subscribe(() => {
      if (handled) return;
      handled = true;
      restarted = session.restart();
    });
    expect(session[action]()).toEqual({ status: "aborted" });
    expect(await restarted).toEqual(success);
    expect(session.snapshot).toMatchObject({ phase: "human-turn", movesCount: 0 });
  });
}

test("restart is aborted if a subscriber stops the empty new position before AI starts", async () => {
  const slow = deferredStrategy();
  const session = makeSingle(slow.strategy, "X");
  session.subscribe(() => {
    if (session.snapshot.phase === "idle") session.stop();
  });
  expect(await session.restart()).toEqual({ status: "aborted" });
  expect(slow.calculateMove).not.toHaveBeenCalled();
  expect(session.snapshot.phase).toBe("paused");
});

test("stop in a Game move callback prevents AI and commits the newly applied human move", async () => {
  const slow = deferredStrategy();
  const game = new Game();
  const session = new SinglePlayerGame({
    game, strategy: slow.strategy, humanSymbol: "O", aiSymbol: "X",
  });
  await session.start();
  game.on(GameEvent.STATE_CHANGE, () => session.stop());
  expect(await session.playMove(0)).toEqual({ status: "aborted" });
  expect(session.snapshot).toMatchObject({ phase: "paused", movesCount: 1, currentPlayer: "X" });
  expect(slow.calculateMove).not.toHaveBeenCalled();
});

test("a callback error while publishing an AI failure remains an application exception", async () => {
  const session = makeSingle({ calculateMove: async () => { throw new Error("AI"); } }, "X");
  const applicationError = new Error("Application subscriber");
  session.subscribe(() => {
    if (session.snapshot.phase === "error") throw applicationError;
  });
  await expect(session.start()).rejects.toBe(applicationError);
  expect(session.snapshot).toMatchObject({ phase: "error", error: { message: "AI" } });
});

test("undo can recover from a failed game without resuming a previous autoplay loop", async () => {
  let calls = 0;
  const session = makeAI({ calculateMove: async () => {
    if (++calls === 1) return 0;
    throw new Error("AI");
  } });
  expect((await session.run()).status).toBe("error");
  expect(session.undo()).toEqual(success);
  expect(session.snapshot).toMatchObject({ phase: "ai-ready", movesCount: 0, error: null });
  expect(calls).toBe(2);
});

for (const method of ["start", "restart", "playMove", "step"] as const) {
  test(`${method} checks operation ownership after its asynchronous helper returns`, async () => {
    const session = method === "step" ? makeAI() : makeSingle(undefined, "X");
    if (method === "playMove" && "start" in session) await session.start();
    let scheduled = false;
    session.on("turn", () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => session.stop());
    });
    let pending;
    if (method === "step" && "step" in session) pending = session.step();
    else if (method === "restart") pending = session.restart();
    else if ("playMove" in session) {
      pending = method === "playMove" ? session.playMove(8) : session.start();
    }
    expect(await pending).toEqual({ status: "aborted" });
    expect(session.snapshot.phase).toBe("paused");
  });
}
