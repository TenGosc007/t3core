import type { AIInput, AIRequest } from "@/index";

import { expect, test, vi } from "vitest";

import { AIProviderError, TicTacToe } from "@/index";

import { createProvider } from "../facade/providers.helpers";

function pendingProvider() {
  const custom = createProvider("pending");
  const requests: AIRequest[] = [];
  const dispose = vi.fn();
  let resolve: (index: number) => void = () => { throw new Error("Not started"); };
  let reject: (error: unknown) => void = () => { throw new Error("Not started"); };
  const provider = { ...custom.provider, create: () => ({
    calculateMove(_input: AIInput, request: AIRequest) {
      requests.push(request);
      return new Promise<number>((accept, fail) => { resolve = accept; reject = fail; });
    },
    dispose,
  }) };
  return { provider, requests, dispose, resolve: (index: number) => resolve(index), reject: (error: unknown) => reject(error) };
}

for (const action of ["stop", "restart", "undo", "dispose"] as const) {
  for (const completion of ["resolve", "reject"] as const) {
    test(`${action} aborts a provider request and ignores a late ${completion}`, async () => {
      const custom = pendingProvider();
      const game = new TicTacToe({
        mode: "singleplayer", aiProviders: [custom.provider],
        ai: { engine: "pending", prefer: "first" },
      });
      await game.start();
      const pending = game.playMove(0);
      const signal = custom.requests[0]?.signal;
      expect(signal?.aborted).toBe(false);
      const aborted = vi.fn();
      signal?.addEventListener("abort", aborted);
      if (action === "restart") await game.restart();
      else game[action]();
      expect(signal?.aborted).toBe(true);
      expect(aborted).toHaveBeenCalledTimes(1);
      expect(await pending).toEqual({ status: "aborted" });
      const snapshot = game.snapshot;
      if (completion === "resolve") custom.resolve(-1);
      else custom.reject(new AIProviderError("ai_initialization_failed", "Late init failure"));
      await Promise.resolve();
      await Promise.resolve();
      expect(game.snapshot).toBe(snapshot);
      expect(custom.dispose).toHaveBeenCalledTimes(action === "dispose" ? 1 : 0);
      game.dispose();
      expect(custom.dispose).toHaveBeenCalledTimes(1);
    });
  }
}

test("each AI calculation receives a distinct signal, and completed requests are not aborted later", async () => {
  const custom = createProvider("choice");
  const game = new TicTacToe({
    mode: "aivsai", aiProviders: [custom.provider],
    aiPlayers: [{ engine: "choice", prefer: "first" }, { engine: "choice", prefer: "last" }],
  });
  await game.run();
  expect(custom.signals.length).toBe(game.movesCount);
  expect(new Set(custom.signals).size).toBe(game.movesCount);
  game.dispose();
  expect(custom.signals.every((signal) => !signal.aborted)).toBe(true);
});

for (const action of ["stop", "restart", "undo"] as const) {
  test(`a restart initiated by an abort listener supersedes the outer ${action}`, async () => {
    const custom = pendingProvider();
    const game = new TicTacToe({
      mode: "singleplayer", aiProviders: [custom.provider],
      ai: { engine: "pending", prefer: "first" },
    });
    await game.start();
    const pending = game.playMove(0);
    let nested: ReturnType<typeof game.restart> | undefined;
    custom.requests[0]?.signal.addEventListener("abort", () => { nested = game.restart(); });
    expect(await game[action]()).toEqual({ status: "aborted" });
    expect(await pending).toEqual({ status: "aborted" });
    expect(await nested).toEqual({ status: "success", value: undefined });
    expect(game.snapshot).toMatchObject({ phase: "human-turn", movesCount: 0 });
    game.dispose();
  });
}

test("a cooperative provider can reject on abort without publishing an error", async () => {
  const custom = createProvider("cooperative");
  const provider = { ...custom.provider, create: () => ({
    calculateMove(_input: AIInput, { signal }: AIRequest) {
      return new Promise<number>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
      });
    },
    dispose() {},
  }) };
  const game = new TicTacToe({
    mode: "singleplayer", humanSymbol: "X", aiProviders: [provider],
    ai: { engine: "cooperative", prefer: "first" },
  });
  const pending = game.start();
  expect(game.stop()).toEqual({ status: "success", value: undefined });
  expect(await pending).toEqual({ status: "aborted" });
  expect(game.snapshot).toMatchObject({ phase: "paused", error: null });
  game.dispose();
});

test("dispose releases both players even when one cleanup throws", () => {
  const custom = createProvider("choice");
  const first = vi.fn(() => { throw new Error("Cleanup failure"); });
  const second = vi.fn();
  let count = 0;
  const provider = { ...custom.provider, create: () => ({
    calculateMove: async () => 0,
    dispose: count++ === 0 ? first : second,
  }) };
  const game = new TicTacToe({
    mode: "aivsai", aiProviders: [provider],
    aiPlayers: [{ engine: "choice", prefer: "first" }, { engine: "choice", prefer: "first" }],
  });
  expect(() => game.dispose()).toThrow("Cleanup failure");
  expect(game.snapshot.phase).toBe("disposed");
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(() => game.dispose()).not.toThrow();
});

test("a disposal subscriber exception is preserved while provider cleanup still runs", () => {
  const custom = createProvider("choice");
  const dispose = vi.fn(() => { throw new Error("Cleanup"); });
  const provider = { ...custom.provider, create: () => ({ calculateMove: async () => 0, dispose }) };
  const game = new TicTacToe({
    mode: "singleplayer", aiProviders: [provider], ai: { engine: "choice", prefer: "first" },
  });
  const error = new Error("Application subscriber");
  game.subscribe(() => { throw error; });
  expect(() => game.dispose()).toThrow(error);
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(game.snapshot.phase).toBe("disposed");
});
