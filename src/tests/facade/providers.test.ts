import type { AIConfig, AIProvider, SinglePlayerOptions } from "@/index";

import { expect, expectTypeOf, test, vi } from "vitest";

import { ProviderCatalog } from "@/facade/catalog/ProviderCatalog";
import { AIProviderError, TicTacToe } from "@/index";
import { classic3x3Strategy } from "@/strategies/variants/classic3x3";

import { createProvider } from "./providers.helpers";

test("capabilities are frozen metadata and never validate options or create engines", () => {
  const custom = createProvider("choice");
  const capabilities = TicTacToe.getCapabilities({ aiProviders: [custom.provider] });
  expect(capabilities).toMatchObject({
    variant: { id: "classic-3x3", rows: 3, columns: 3, winLength: 3 },
    modes: ["pvp", "singleplayer", "aivsai"], defaultAIEngine: "alphabeta",
    aiEngines: [
      { id: "alphabeta", version: "1.0.0", difficulties: ["normal", "hard"], defaultDifficulty: "normal" },
      { id: "random", version: "1.0.0", difficulties: [], defaultDifficulty: null },
      { id: "choice", version: "1.0.0", difficulties: [], defaultDifficulty: null },
    ],
  });
  expect(custom.create).not.toHaveBeenCalled();
  expect(custom.validateOptions).not.toHaveBeenCalled();
  for (const value of [capabilities, capabilities.variant, capabilities.modes,
    capabilities.aiEngines, ...capabilities.aiEngines,
    ...capabilities.aiEngines.map((engine) => engine.difficulties)]) {
    expect(Object.isFrozen(value)).toBe(true);
  }
  expect(capabilities.aiEngines[2]).not.toHaveProperty("create");
  expect(TicTacToe.getCapabilities().aiEngines).toHaveLength(2);
});

test("an isolated known PvP-only rule variant is valid, while an unknown variant is an error", () => {
  const descriptor = Object.freeze({ ...classic3x3Strategy.descriptor, id: "test-pvp-only-3x3" });
  const rules = Object.freeze({ ...classic3x3Strategy, descriptor });
  const catalog = new ProviderCatalog(descriptor.id, [], new Map([[descriptor.id, rules]]));
  expect(catalog.capabilities()).toEqual({
    variant: descriptor, modes: ["pvp"], defaultAIEngine: null, aiEngines: [],
  });
  expect(() => catalog.prepare()).toThrow("No default");
  expect(() => catalog.prepare({ engine: "alphabeta" })).toThrow("does not support");
  expect(() => new ProviderCatalog("unknown", [], new Map([[descriptor.id, rules]]))).toThrow("Unsupported");
});

test("capability discovery validates JavaScript query options", () => {
  for (const options of [null, [], { variant: null }, { variant: 9 },
    { variant: "unknown" }, { aiProviders: {} }, { ignored: true }]) {
    expect(() => Reflect.apply(TicTacToe.getCapabilities, TicTacToe, [options])).toThrow();
  }
});

test("a custom provider is selected by engine and receives immutable data and read-only rules", async () => {
  const custom = createProvider("choice");
  const game = new TicTacToe({
    mode: "singleplayer", humanSymbol: "X", aiProviders: [custom.provider],
    ai: { engine: "choice", prefer: "last" },
  });
  expect(custom.create).toHaveBeenCalledTimes(1);
  expect(custom.inputs).toHaveLength(0);
  expect(await game.start()).toEqual({ status: "success", value: undefined });
  expect(game.board[8]).toBe("O");
  const input = custom.inputs[0];
  if (!input) throw new Error("Missing provider input");
  expect(input).toMatchObject({
    aiSymbol: "O", opponentSymbol: "X", variant: { id: "classic-3x3" },
    gameStatus: { status: "running" },
  });
  expect(input.rules.getStatus(input.board)).toEqual({ status: "running" });
  for (const value of [input, input.board, input.gameStatus, input.variant, input.rules]) {
    expect(Object.isFrozen(value)).toBe(true);
  }
  expect(input.rules).not.toHaveProperty("savePlayerMove");
  expect(input.rules.isLegalMove(input.board, -1, "O")).toBe(false);
  const played = [...input.board];
  played[0] = "O";
  played[1] = "O";
  played[2] = "O";
  expect(input.rules.getStatus(played)).toEqual({ status: "win", winner: "O" });
  game.dispose();
  game.dispose();
  expect(custom.cleanups[0]).toHaveBeenCalledTimes(1);
});

test("factories create separate players and sessions, with independently typed configurations", async () => {
  const custom = createProvider("choice");
  const options = {
    mode: "aivsai", aiProviders: [custom.provider],
    aiPlayers: [{ engine: "choice", prefer: "first" }, { engine: "choice", prefer: "last" }],
  } as const;
  const first = new TicTacToe(options);
  const second = new TicTacToe(options);
  expect(custom.create).toHaveBeenCalledTimes(4);
  await first.step();
  await first.step();
  expect(first.board[0]).toBe("O");
  expect(first.board[8]).toBe("X");
  expect(second.movesCount).toBe(0);
  first.dispose();
  expect(custom.cleanups.slice(0, 2).every((cleanup) => cleanup.mock.calls.length === 1)).toBe(true);
  expect(custom.cleanups.slice(2).every((cleanup) => cleanup.mock.calls.length === 0)).toBe(true);
  second.dispose();
});

for (const invalid of [
  { mode: "singleplayer", ai: { engine: "missing" } },
  { mode: "singleplayer", ai: { engine: "random", difficulty: "hard" } },
  { mode: "singleplayer", ai: { difficulty: "easy" } },
  { mode: "singleplayer", ai: { seed: Infinity } },
  { mode: "singleplayer", ai: { budget: 20 } },
  { mode: "singleplayer", ai: null },
  { mode: "singleplayer", ai: [] },
  { mode: "singleplayer", humanSymbol: "Y" },
  { mode: "pvp", ai: {} },
  { mode: "aivsai", aiPlayers: [{}] },
  { mode: "aivsai", aiPlayers: [{ engine: "random" }, undefined] },
  { mode: "aivsai", aiPlayers: [undefined, {}] },
  { mode: "aivsai", aiPlayers: Object.assign(new Array<object>(2), { 0: { engine: "random" } }) },
  { mode: "pvp", ignored: undefined },
  { mode: "pvp", variant: "connect-9x9-5" },
  { mode: "pvp", variant: "toString" },
  { mode: "pvp", aiProviders: {} },
  { mode: "pvp", ignored: true },
]) {
  test("invalid JavaScript configuration is rejected: " + JSON.stringify(invalid), () => {
    expect(() => Reflect.construct(TicTacToe, [invalid])).toThrow();
  });
}

test("undefined fields of other modes are omitted, and an empty AI config selects the default", () => {
  new TicTacToe({ mode: "pvp", humanSymbol: undefined, ai: undefined, aiPlayers: undefined }).dispose();
  new TicTacToe({ mode: "singleplayer", ai: undefined, aiPlayers: undefined }).dispose();
  const game = new TicTacToe({ mode: "aivsai", aiPlayers: [{}, {}], humanSymbol: undefined, ai: undefined });
  expect(game.mode).toBe("aivsai");
  game.dispose();
});

test("an explicit undefined difficulty is treated like an omitted one", () => {
  const custom = createProvider("choice");
  new TicTacToe({ mode: "singleplayer", ai: { engine: "random", difficulty: undefined } }).dispose();
  const choice = { engine: "choice", prefer: "first", difficulty: undefined } as const;
  new TicTacToe({ mode: "singleplayer", aiProviders: [custom.provider], ai: choice }).dispose();
  expect(custom.validateOptions).toHaveBeenCalledWith({ prefer: "first" });
});

test("provider caller input can omit fields that validation normalizes with defaults", () => {
  type DeepOptions = { readonly depth: number };
  const choice = createProvider("choice");
  const created: DeepOptions[] = [];
  const deep: AIProvider<"deep", DeepOptions, { readonly depth?: number }> = {
    id: "deep", version: "1.0.0", supportedVariants: ["classic-3x3"],
    difficulties: [], defaultDifficulty: null,
    validateOptions(options) {
      const depth = typeof options === "object" && options !== null && "depth" in options ? options.depth : 3;
      if (typeof depth !== "number") throw new TypeError("Expected a numeric depth.");
      return { depth };
    },
    create(options) {
      created.push(options);
      return choice.create({ prefer: "first" });
    },
  };
  expectTypeOf<{ engine: "deep" }>().toExtend<AIConfig<readonly [typeof deep]>>();
  expectTypeOf<{ engine: "deep"; depth: "3" }>().not.toExtend<AIConfig<readonly [typeof deep]>>();
  expectTypeOf(deep.create).parameter(0).toEqualTypeOf<DeepOptions>();
  const game = new TicTacToe({
    mode: "aivsai", aiProviders: [deep], aiPlayers: [{ engine: "deep" }, { engine: "deep", depth: 5 }],
  });
  expect(created).toEqual([{ depth: 3 }, { depth: 5 }]);
  game.dispose();
});

test("both AI configurations are validated before any factory is called", () => {
  const custom = createProvider("choice");
  expect(() => new TicTacToe({
    mode: "aivsai", aiProviders: [custom.provider],
    aiPlayers: [{ engine: "choice", prefer: "first" }, { engine: "random", seed: NaN }],
  })).toThrow("finite");
  expect(custom.create).not.toHaveBeenCalled();
});

test("an incompatible engine is rejected before its factory or option validation", () => {
  const custom = createProvider("choice");
  const provider = { ...custom.provider, supportedVariants: ["other-rules"] };
  expect(TicTacToe.getCapabilities({ aiProviders: [provider] }).aiEngines).toHaveLength(2);
  expect(() => new TicTacToe({
    mode: "singleplayer", aiProviders: [provider], ai: { engine: "choice", prefer: "first" },
  })).toThrow("does not support");
  expect(custom.create).not.toHaveBeenCalled();
  expect(custom.validateOptions).not.toHaveBeenCalled();
});

test("duplicate IDs and invalid metadata are rejected without creating strategies", () => {
  const custom = createProvider("choice");
  for (const providers of [
    [custom.provider, custom.provider],
    [{ ...custom.provider, id: "random" }],
    [{ ...custom.provider, version: "" }],
    [{ ...custom.provider, difficulties: ["hard"], defaultDifficulty: null }],
    [{ ...custom.provider, difficulties: [], defaultDifficulty: "hard" }],
    [{ ...custom.provider, supportedVariants: ["classic-3x3", "classic-3x3"] }],
  ]) {
    expect(() => TicTacToe.getCapabilities({ aiProviders: providers })).toThrow();
  }
  expect(custom.create).not.toHaveBeenCalled();
});

test("constructor failure cleans up an already-created player", () => {
  const custom = createProvider("choice");
  let calls = 0;
  const provider = { ...custom.provider, create: () => {
    if (++calls === 2) throw new Error("Factory failed");
    return custom.provider.create({ prefer: "first" });
  } };
  expect(() => new TicTacToe({
    mode: "aivsai", aiProviders: [provider],
    aiPlayers: [{ engine: "choice", prefer: "first" }, { engine: "choice", prefer: "last" }],
  })).toThrow("Factory failed");
  expect(custom.cleanups[0]).toHaveBeenCalledTimes(1);
});

test("a factory cannot reuse the same strategy for both players", () => {
  const custom = createProvider("choice");
  const strategy = custom.provider.create({ prefer: "first" });
  const provider = { ...custom.provider, create: () => strategy };
  expect(() => new TicTacToe({
    mode: "aivsai", aiProviders: [provider],
    aiPlayers: [{ engine: "choice", prefer: "first" }, { engine: "choice", prefer: "last" }],
  })).toThrow("private strategy");
  expect(custom.cleanups[0]).toHaveBeenCalledTimes(1);
});

for (const code of ["ai_initialization_failed", "ai_timeout"] as const) {
  test("lazy provider failure is a serializable " + code + " action", async () => {
    const custom = createProvider("choice");
    const dispose = vi.fn();
    const provider = { ...custom.provider, create: () => ({
      calculateMove: async () => { throw new AIProviderError(code, "Provider error"); }, dispose,
    }) };
    const game = new TicTacToe({
      mode: "singleplayer", humanSymbol: "X", aiProviders: [provider],
      ai: { engine: "choice", prefer: "first" },
    });
    expect(game.snapshot.phase).toBe("idle");
    expect(await game.start()).toEqual({ status: "error", error: { code, message: "Provider error" } });
    expect(game.snapshot.error).toEqual({ code, message: "Provider error" });
    expect(await game.start()).toEqual({ status: "rejected", reason: "session_error" });
    game.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
}

test("provider generics retain engine-specific configuration", () => {
  type Custom = AIProvider<"choice", { prefer: "first" | "last" }>;
  expectTypeOf<{ engine: "choice"; prefer: "last" }>().toExtend<AIConfig<readonly [Custom]>>();
  expectTypeOf<{ engine: "choice"; prefer: number }>().not.toExtend<AIConfig<readonly [Custom]>>();
  expectTypeOf<{ mode: "pvp"; ai: object }>().not.toExtend<SinglePlayerOptions>();
  const invalid = () => {
    const custom = createProvider("choice");
    // @ts-expect-error Unknown engine cannot be inferred from the AI config alone.
    new TicTacToe({ mode: "singleplayer", ai: { engine: "missing" } });
    // @ts-expect-error A custom engine must be registered on this instance.
    new TicTacToe({ mode: "singleplayer", ai: { engine: "choice", prefer: "first" } });
    // @ts-expect-error Options remain tied to the supplied custom provider.
    new TicTacToe({ mode: "singleplayer", aiProviders: [custom.provider], ai: { engine: "choice", prefer: 12 } });
    // @ts-expect-error Built-in random AI has no difficulty option.
    new TicTacToe({ mode: "singleplayer", aiProviders: [custom.provider], ai: { engine: "random", difficulty: "hard" } });
  };
  expect(invalid).toBeTypeOf("function");
});
