import type { MoveStrategy } from "@/ai/types";
import type { SessionSnapshot } from "@/index";

import { expect, test, vi } from "vitest";

import { Game } from "@/game/Game";
import { GameEvent } from "@/game/types/Game.types";
import { AIGame } from "@/sessions/AIGame";
import { PvPGame } from "@/sessions/PvPGame";
import { SinglePlayerGame } from "@/sessions/SinglePlayerGame";

function deferredMove() {
  let resolve: (move: number) => void = () => { throw new Error("Not initialized"); };
  let reject: (error: unknown) => void = () => { throw new Error("Not initialized"); };
  const promise = new Promise<number>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  const calculateMove = vi.fn(() => promise);
  const strategy: MoveStrategy = { calculateMove };
  return { strategy, resolve, reject, calculateMove };
}

function singlePlayer(strategy: MoveStrategy, humanSymbol: "O" | "X" = "O") {
  return new SinglePlayerGame({
    game: new Game(),
    strategy,
    humanSymbol,
    aiSymbol: humanSymbol === "O" ? "X" : "O",
  });
}

test("initial state is complete, deeply frozen and stable across reads", async () => {
  const session = new PvPGame({ game: new Game() });
  const { getSnapshot, subscribe } = session;
  const initial = getSnapshot();
  expect(initial).toEqual({
    board: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    variant: { id: "classic-3x3", rows: 3, columns: 3, winLength: 3, lineRule: "at-least" },
    mode: "pvp", humanSymbol: null, currentPlayer: "O",
    gameStatus: { status: "running" }, phase: "idle", canPlay: false,
    legalMoves: [0, 1, 2, 3, 4, 5, 6, 7, 8], movesCount: 0, canUndo: false, error: null,
  });
  for (const value of [initial, initial.board, initial.variant, initial.gameStatus, initial.legalMoves]) {
    expect(Object.isFrozen(value)).toBe(true);
  }
  const listener = vi.fn();
  subscribe(listener);
  expect(getSnapshot()).toBe(initial);
  expect(listener).not.toHaveBeenCalled();
  await session.start();
  expect(listener).toHaveBeenCalledTimes(1);
  const started = getSnapshot();
  expect(started.phase).toBe("human-turn");
  expect(started.canPlay).toBe(true);
  expect(started.board).toBe(initial.board);
  expect(started.legalMoves).toBe(initial.legalMoves);
  expect(getSnapshot()).toBe(started);
});

test("the human move and thinking phase are published together before events and calculation", async () => {
  const pending = deferredMove();
  const session = singlePlayer(pending.strategy);
  await session.start();
  const snapshots: SessionSnapshot[] = [];
  const order: string[] = [];
  session.subscribe(() => {
    snapshots.push(session.getSnapshot());
    order.push("snapshot:" + session.snapshot.phase);
  });
  session.on("move", ({ player }) => order.push("move:" + player));
  session.on("ai-thinking", () => order.push("thinking"));
  session.on("turn", () => order.push("turn"));

  const result = session.playMove(0);
  expect(order).toEqual(["snapshot:ai-thinking", "move:O", "thinking"]);
  expect(pending.calculateMove).toHaveBeenCalledTimes(1);
  expect(session.snapshot).toMatchObject({
    phase: "ai-thinking", canPlay: false, currentPlayer: "X", movesCount: 1, canUndo: true,
  });
  expect(session.snapshot.legalMoves).not.toContain(0);
  const thinking = session.snapshot;
  expect(await session.playMove(1)).toEqual({ status: "rejected", reason: "busy" });
  expect(session.snapshot).toBe(thinking);
  pending.resolve(4);
  expect(await result).toEqual({ status: "success", value: undefined });
  expect(order).toEqual([
    "snapshot:ai-thinking", "move:O", "thinking",
    "snapshot:human-turn", "move:X", "turn",
  ]);
  expect(snapshots).toHaveLength(2);
  expect(session.snapshot).toMatchObject({ canPlay: true, movesCount: 2, currentPlayer: "O" });
  expect(thinking.board[4]).toBe(5);
});

test("an AI opening publishes thinking with the unchanged board before awaiting", async () => {
  const pending = deferredMove();
  const session = singlePlayer(pending.strategy, "X");
  const initial = session.snapshot;
  const result = session.start();
  expect(session.snapshot).toMatchObject({ phase: "ai-thinking", canPlay: false, canUndo: false });
  expect(session.snapshot.board).toBe(initial.board);
  expect(session.snapshot.legalMoves).toBe(initial.legalMoves);
  pending.resolve(4);
  await result;
  expect(session.snapshot).toMatchObject({ phase: "human-turn", currentPlayer: "X", canUndo: false });
});

test("a terminal human move publishes finished once and never calls AI", async () => {
  const game = new Game();
  for (const move of [0, 3, 1, 4]) game.savePlayerMove(move);
  const calculateMove = vi.fn(async () => 8);
  const session = new SinglePlayerGame({ game, strategy: { calculateMove }, humanSymbol: "O", aiSymbol: "X" });
  await session.start();
  const phases: string[] = [];
  session.subscribe(() => phases.push(session.snapshot.phase));
  session.on("finished", () => expect(session.snapshot.phase).toBe("finished"));
  await session.playMove(2);
  expect(phases).toEqual(["finished"]);
  expect(calculateMove).not.toHaveBeenCalled();
  expect(session.snapshot).toMatchObject({
    canPlay: false, legalMoves: [], movesCount: 5, gameStatus: { status: "win", winner: "O" },
  });
  expect(Object.isFrozen(session.snapshot.gameStatus)).toBe(true);
  expect(Object.isFrozen(session.snapshot.legalMoves)).toBe(true);
});

for (const mode of ["singleplayer", "aivsai"] as const) {
  for (const failure of ["reject", "illegal"] as const) {
    test(`${mode} publishes a frozen error for ${failure} without changing the board`, async () => {
      const error = new Error("Calculation failed");
      const strategy: MoveStrategy = {
        calculateMove: async () => {
          if (failure === "reject") throw error;
          return 100;
        },
      };
      const session = mode === "singleplayer"
        ? singlePlayer(strategy, "X")
        : new AIGame({ game: new Game(), strategies: [strategy, strategy] });
      const initial = session.snapshot;
      const phases: string[] = [];
      session.subscribe(() => phases.push(session.snapshot.phase));
      const result = session instanceof AIGame ? session.step() : session.start();
      expect(await result).toMatchObject({
        status: "error", error: { code: failure === "reject" ? "ai_failed" : "illegal_ai_move" },
      });
      expect(phases).toEqual(["ai-thinking", "error"]);
      expect(session.snapshot).toMatchObject({
        phase: "error", canPlay: false, gameStatus: { status: "running" },
        error: { code: failure === "reject" ? "ai_failed" : "illegal_ai_move" },
      });
      expect(session.snapshot.board).toBe(initial.board);
      expect(session.snapshot.legalMoves).toBe(initial.legalMoves);
      expect(Object.isFrozen(session.snapshot.error)).toBe(true);
      const publishedError = session.snapshot.error;
      session.dispose();
      expect(session.snapshot).toMatchObject({ phase: "disposed", error: publishedError });
    });
  }

  for (const completion of ["resolve", "reject"] as const) {
    test(`${mode} ignores a late AI ${completion} after stop and a new operation`, async () => {
      const old = deferredMove();
      const fresh = deferredMove();
      let calls = 0;
      const strategy: MoveStrategy = {
        calculateMove: (board, context) => (++calls === 1 ? old.strategy : fresh.strategy).calculateMove(board, context),
      };
      const session = mode === "singleplayer"
        ? singlePlayer(strategy, "X")
        : new AIGame({ game: new Game(), strategies: [strategy, strategy] });
      const begin = () => session instanceof AIGame ? session.step() : session.start();
      const first = begin();
      session.stop();
      const second = begin();
      const current = session.snapshot;
      const listener = vi.fn();
      session.subscribe(listener);
      if (completion === "resolve") old.resolve(-1);
      else old.reject(new Error("Stale"));
      expect(await first).toEqual({ status: "aborted" });
      expect(session.snapshot).toBe(current);
      expect(listener).not.toHaveBeenCalled();
      expect(await begin()).toEqual({ status: "rejected", reason: "busy" });
      fresh.resolve(4);
      expect(await second).toEqual({ status: "success", value: undefined });
      expect(session.snapshot.board[4]).toBe("O");
    });
  }
}

test("AI-vs-AI steps publish readiness, while continuous play has no intermediate ready phase", async () => {
  const strategy: MoveStrategy = {
    calculateMove: async (board) => board.findIndex((field) => typeof field === "number"),
  };
  const session = new AIGame({ game: new Game(), strategies: [strategy, strategy] });
  const snapshots: SessionSnapshot[] = [];
  session.subscribe(() => snapshots.push(session.snapshot));
  await session.step();
  expect(snapshots.map((state) => state.phase)).toEqual(["ai-thinking", "ai-ready"]);
  const ready = session.snapshot;
  snapshots.length = 0;
  await session.run();
  expect(snapshots[0]?.board).toBe(ready.board);
  expect(snapshots[0]?.legalMoves).toBe(ready.legalMoves);
  expect(snapshots.map((state) => state.phase)).toEqual([
    "ai-thinking", "ai-thinking", "ai-thinking", "ai-thinking",
    "ai-thinking", "ai-thinking", "finished",
  ]);
  expect(snapshots.map((state) => state.movesCount)).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test("a ready-state subscriber can start a new operation without the old finally unlocking it", async () => {
  const first = deferredMove();
  const second = deferredMove();
  let calls = 0;
  const strategy: MoveStrategy = {
    calculateMove: (board, context) => (++calls === 1 ? first.strategy : second.strategy).calculateMove(board, context),
  };
  const session = singlePlayer(strategy);
  await session.start();
  let next: ReturnType<typeof session.playMove> | undefined;
  let launched = false;
  session.subscribe(() => {
    if (session.snapshot.canPlay && !launched) {
      launched = true;
      next = session.playMove(1);
    }
  });
  const previous = session.playMove(0);
  first.resolve(4);
  expect(await previous).toEqual({ status: "aborted" });
  expect(second.calculateMove).toHaveBeenCalledTimes(1);
  expect(await session.playMove(2)).toEqual({ status: "rejected", reason: "busy" });
  second.resolve(5);
  expect(await next).toEqual({ status: "success", value: undefined });
  expect(session.snapshot).toMatchObject({ phase: "human-turn", movesCount: 4 });
});

test("nested stop supersedes notification delivery and removed listeners are skipped", async () => {
  const session = new PvPGame({ game: new Game() });
  const seen: string[] = [];
  session.subscribe(() => {
    if (session.snapshot.phase === "human-turn") session.stop();
  });
  const removed = vi.fn();
  let remove = () => {};
  session.subscribe(() => { remove(); });
  remove = session.subscribe(removed);
  session.subscribe(() => seen.push(session.snapshot.phase));
  expect(await session.start()).toEqual({ status: "aborted" });
  expect(seen).toEqual(["paused"]);
  expect(removed).not.toHaveBeenCalled();
});

for (const source of ["subscriber", "event", "game"] as const) {
  test(`a throwing ${source} callback propagates without being classified as an AI failure`, async () => {
    const game = new Game();
    const pending = deferredMove();
    const session = new SinglePlayerGame({
      game, strategy: pending.strategy, humanSymbol: "O", aiSymbol: "X",
    });
    await session.start();
    const error = new Error("Application callback");
    const fail = () => { throw error; };
    if (source === "subscriber") session.subscribe(fail);
    else if (source === "event") session.on("ai-thinking", fail);
    else game.on(GameEvent.STATE_CHANGE, fail);
    await expect(session.playMove(0)).rejects.toBe(error);
    expect(session.snapshot).toMatchObject({
      phase: "paused", canPlay: false, error: null, movesCount: 1,
    });
    expect(pending.calculateMove).not.toHaveBeenCalled();
  });
}

test("restart from an error subscriber invalidates the original rejection", async () => {
  let calls = 0;
  const session = singlePlayer({ calculateMove: async () => {
    if (++calls === 1) throw new Error("AI");
    return 4;
  } }, "X");
  let restarted: ReturnType<typeof session.restart> | undefined;
  session.subscribe(() => {
    if (session.snapshot.phase === "error") restarted = session.restart();
  });
  expect(await session.start()).toEqual({ status: "aborted" });
  expect(await restarted).toEqual({ status: "success", value: undefined });
  expect(session.snapshot).toMatchObject({ phase: "human-turn", error: null, movesCount: 1 });
});

test("session move count describes the restored position, not retained future history", () => {
  const game = new Game();
  for (const move of [0, 4, 1, 5]) game.savePlayerMove(move);
  game.backToMove(1);
  const session = new PvPGame({ game });
  expect(session.movesCount).toBe(session.board.filter((field) => typeof field === "string").length);
  expect(session.movesCount).toBeLessThan(game.movesCount);
});

test("restart pauses coherently when a low-level Game callback throws", async () => {
  const pending = deferredMove();
  const game = new Game();
  const session = new SinglePlayerGame({
    game, strategy: pending.strategy, humanSymbol: "X", aiSymbol: "O",
  });
  const opening = session.start();
  const error = new Error("Restart callback");
  game.on(GameEvent.STATE_CHANGE, () => { throw error; });

  await expect(session.restart()).rejects.toBe(error);
  expect(session.snapshot).toMatchObject({ phase: "paused", error: null, movesCount: 0 });
  pending.resolve(4);
  expect(await opening).toEqual({ status: "aborted" });
  expect(session.snapshot.phase).toBe("paused");
});

test("a nested stop in a Game restart callback supersedes the restarting operation", async () => {
  const game = new Game();
  const session = new PvPGame({ game });
  await session.start();
  await session.playMove(0);
  game.on(GameEvent.STATE_CHANGE, () => { session.stop(); });
  expect(await session.restart()).toEqual({ status: "aborted" });
  expect(session.snapshot).toMatchObject({ phase: "paused", canPlay: false, movesCount: 0 });
});
