import { expect, test, vi } from "vitest";

import { Game } from "@/game/Game";
import { PvPGame } from "@/sessions/PvPGame";

import { deferredStrategy, makeAI, makeSingle, success } from "./lifecycle.helpers";

test("PvP undo restores turn and result, and a new move replaces the future branch", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  expect(session.undo()).toEqual({ status: "rejected", reason: "no_history" });
  await session.start();
  for (const move of [0, 3, 1, 4, 2]) await session.playMove(move);
  expect(session.snapshot.phase).toBe("finished");
  expect(session.undo()).toEqual(success);
  expect(session.snapshot).toMatchObject({ phase: "human-turn", currentPlayer: "O", movesCount: 4, error: null });
  expect(session.board[2]).toBe(3);
  await session.playMove(8);
  expect(game.movesCount).toBe(5);
  expect(session.undo()).toEqual(success);
  expect(session.board[8]).toBe(9);
  expect(session.board[2]).toBe(3);
});

for (const human of ["O", "X"] as const) {
  test(`singleplayer undo with human ${human} removes a complete decision, preserving an AI opening`, async () => {
    const session = makeSingle(undefined, human);
    await session.start();
    const baseline = session.snapshot;
    const move = baseline.legalMoves[baseline.legalMoves.length - 1];
    if (move === undefined) throw new Error("Missing human move");
    await session.playMove(move);
    expect(session.movesCount).toBe(baseline.movesCount + 2);
    expect(session.undo()).toEqual(success);
    expect(session.board).toEqual(baseline.board);
    expect(session.snapshot).toMatchObject({
      phase: "human-turn", canPlay: true, currentPlayer: human, canUndo: false,
    });
    const state = session.snapshot;
    expect(session.undo()).toEqual({ status: "rejected", reason: "no_history" });
    expect(session.snapshot).toBe(state);
  });
}

test("undo of a terminal human move restores just that decision", async () => {
  const choices = [3, 4];
  const session = makeSingle({ calculateMove: async () => {
    const choice = choices.shift();
    if (choice === undefined) throw new Error("Unexpected AI call");
    return choice;
  } });
  await session.start();
  await session.playMove(0);
  await session.playMove(1);
  const beforeWin = session.snapshot;
  await session.playMove(2);
  expect(session.snapshot.phase).toBe("finished");
  expect(session.undo()).toEqual(success);
  expect(session.board).toEqual(beforeWin.board);
  expect(session.movesCount).toBe(4);
  expect(session.currentPlayer).toBe("O");
});

test("undo after a terminal AI reply removes that reply and its preceding human move", async () => {
  const choices = [0, 1, 2];
  const session = makeSingle({ calculateMove: async () => {
    const choice = choices.shift();
    if (choice === undefined) throw new Error("Unexpected AI call");
    return choice;
  } }, "X");
  await session.start(); // O0
  await session.playMove(3); // X3, O1
  const previous = session.snapshot;
  await session.playMove(4); // X4, O2 wins
  expect(session.snapshot.phase).toBe("finished");
  expect(session.undo()).toEqual(success);
  expect(session.board).toEqual(previous.board);
  expect(session.currentPlayer).toBe("X");
});

test("undo cancels a pending reply immediately and never applies its late move", async () => {
  const slow = deferredStrategy();
  const session = makeSingle(slow.strategy);
  await session.start();
  const pending = session.playMove(0);
  expect(session.undo()).toEqual(success);
  expect(await pending).toEqual({ status: "aborted" });
  const state = session.snapshot;
  expect(state).toMatchObject({ phase: "human-turn", movesCount: 0, canUndo: false });
  slow.resolve(4);
  await Promise.resolve();
  expect(session.snapshot).toBe(state);
});

test("undo during AI opening is a no-history refusal that does not cancel the opening", async () => {
  const slow = deferredStrategy();
  const session = makeSingle(slow.strategy, "X");
  const opening = session.start();
  const thinking = session.snapshot;
  expect(session.snapshot.canUndo).toBe(false);
  expect(session.undo()).toEqual({ status: "rejected", reason: "no_history" });
  expect(session.snapshot).toBe(thinking);
  slow.resolve(4);
  expect(await opening).toEqual(success);
});

test("undo after an AI failure clears the error and permits a new human decision", async () => {
  let calls = 0;
  const session = makeSingle({ calculateMove: async () => {
    if (++calls === 1) throw new Error("Failed");
    return 4;
  } });
  await session.start();
  expect((await session.playMove(0)).status).toBe("error");
  expect(session.undo()).toEqual(success);
  expect(session.snapshot).toMatchObject({ phase: "human-turn", error: null, movesCount: 0 });
  expect(await session.playMove(1)).toEqual(success);
});

for (const mode of ["pvp", "singleplayer", "aivsai"] as const) {
  test(`undo preserves pause in ${mode} without starting AI or emitting move events`, async () => {
    const session = mode === "pvp" ? new PvPGame({ game: new Game() })
      : mode === "singleplayer" ? makeSingle() : makeAI();
    if (session instanceof PvPGame) {
      await session.start();
      await session.playMove(4);
    } else if ("playMove" in session) {
      await session.start();
      await session.playMove(4);
    } else await session.step();
    session.stop();
    const events = vi.fn();
    session.on("move", events);
    session.on("ai-thinking", events);
    session.on("turn", events);
    expect(session.undo()).toEqual(success);
    expect(session.snapshot).toMatchObject({ phase: "paused", canPlay: false, movesCount: 0, error: null });
    expect(events).not.toHaveBeenCalled();
  });
}

test("undo in AI-vs-AI cancels autoplay and waits in ai-ready", async () => {
  const slow = deferredStrategy();
  let calls = 0;
  const session = makeAI({ calculateMove: (board, context) => {
    if (++calls === 1) return Promise.resolve(0);
    return slow.strategy.calculateMove(board, context);
  } });
  // First perform one step, then autoplay the next player with a pending strategy.
  await session.step();
  const continueRun = session.run();
  expect(session.undo()).toEqual(success);
  expect(await continueRun).toEqual({ status: "aborted" });
  expect(session.snapshot).toMatchObject({ phase: "ai-ready", movesCount: 0 });
  expect(calls).toBe(2);
  slow.reject(new Error("Stale"));
  await Promise.resolve();
  expect(session.snapshot).toMatchObject({ phase: "ai-ready", error: null });
});
