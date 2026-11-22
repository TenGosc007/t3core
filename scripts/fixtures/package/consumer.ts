import type {
  AIConfig,
  AIProvider,
  AIRequest,
  BoardSnapshot,
  GameCapabilities,
  PlayerSymbol,
  PvPInstance,
  RestartResult,
  SessionSnapshot,
  SnapshotFor,
  StopResult,
  TicTacToeOptions,
  UndoResult,
} from "t3core";

import * as core from "t3core";
import { AIProviderError, TicTacToe } from "t3core";

let providerFactories = 0;
let providerDisposals = 0;
let observedSignal: AbortSignal | undefined;
const choiceProvider: AIProvider<"choice", { prefer: "first" | "last" }> = {
  id: "choice", version: "1.0.0", supportedVariants: ["classic-3x3"],
  difficulties: [], defaultDifficulty: null,
  validateOptions(options) {
    if (typeof options !== "object" || options === null || !("prefer" in options) ||
        (options.prefer !== "first" && options.prefer !== "last")) {
      throw new TypeError("Expected prefer: first or last");
    }
    return { prefer: options.prefer };
  },
  create({ prefer }) {
    providerFactories++;
    return {
      async calculateMove(input, request: AIRequest) {
        observedSignal = request.signal;
        const board: BoardSnapshot = input.board;
        const symbol: PlayerSymbol = input.aiSymbol;
        const moves = input.rules.getLegalMoves(board, symbol);
        const index = prefer === "first" ? moves[0] : moves[moves.length - 1];
        if (index === undefined) throw new Error("No legal moves");
        return index;
      },
      dispose() { providerDisposals++; },
    };
  },
};

async function verifyConsumer() {
  if (Object.keys(core).sort().join() !== "AIProviderError,TicTacToe") {
    throw new Error("The runtime public API contains unexpected exports");
  }
  const capabilities: GameCapabilities = TicTacToe.getCapabilities({ aiProviders: [choiceProvider] });
  if (providerFactories !== 0 || !Object.isFrozen(capabilities.aiEngines) ||
      !capabilities.aiEngines.some((engine) => engine.id === "choice")) {
    throw new Error("Capabilities must expose metadata without creating an engine");
  }
  const custom = new TicTacToe({
    mode: "singleplayer", humanSymbol: "X", aiProviders: [choiceProvider],
    ai: { engine: "choice", prefer: "last" },
  });
  if ((await custom.start()).status !== "success" || custom.board[8] !== "O" ||
      observedSignal === undefined || observedSignal.aborted) {
    throw new Error("Typed custom provider or rule input does not work");
  }
  custom.dispose();
  custom.dispose();
  if (providerDisposals !== 1) throw new Error("Provider resources must be disposed once");

  const pvp: PvPInstance = new TicTacToe({ mode: "pvp" });
  const { getSnapshot, subscribe } = pvp;
  const initial: SnapshotFor<"pvp"> = getSnapshot();
  const states: SessionSnapshot[] = [];
  const unsubscribe = subscribe(() => states.push(getSnapshot()));
  await pvp.start();
  if (getSnapshot().phase !== "human-turn" || getSnapshot().board !== initial.board) {
    throw new Error("Session phase or reference stability is broken");
  }
  const moved = await pvp.playMove(4);
  if (moved.status !== "success" || pvp.board[4] !== "O" || states.length !== 2 ||
      getSnapshot() !== pvp.snapshot || !Object.isFrozen(pvp.snapshot.legalMoves)) {
    throw new Error("Gameplay, observation or immutability is broken");
  }
  unsubscribe();
  unsubscribe();
  const restarted: RestartResult = await pvp.restart();
  const stopped: StopResult = pvp.stop();
  const undone: UndoResult = pvp.undo();
  if (restarted.status !== "success" || stopped.status !== "success" ||
      undone.status !== "rejected" || undone.reason !== "no_history" || states.length !== 2) {
    throw new Error("Lifecycle results or subscription cleanup are broken");
  }
  pvp.dispose();
  if ("reset" in pvp) throw new Error("The transitional reset method must be absent");

  const ai = new TicTacToe({
    mode: "aivsai",
    aiPlayers: [{ engine: "alphabeta", difficulty: "hard", seed: 1 }, { engine: "random", seed: 2 }],
  });
  const completed = await ai.run();
  if (completed.status !== "success" || completed.value.status !== ai.gameStatus.status) {
    throw new Error("AI-vs-AI must return its terminal result");
  }
  if (ai.undo().status !== "success" || ai.snapshot.phase !== "ai-ready") {
    throw new Error("AI undo must stop at a ready position");
  }
  ai.dispose();
  if ((await ai.run()).status !== "rejected") throw new Error("Disposed session accepted work");

  const failingProvider: AIProvider<"failing"> = {
    ...choiceProvider, id: "failing", validateOptions: () => ({}),
    create: () => ({
      async calculateMove() { throw new AIProviderError("ai_initialization_failed", "Initialization failed"); },
      dispose() {},
    }),
  };
  const failing = new TicTacToe({
    mode: "singleplayer", humanSymbol: "X", aiProviders: [failingProvider], ai: { engine: "failing" },
  });
  const failed = await failing.start();
  if (failed.status !== "error" || failed.error.code !== "ai_initialization_failed" || failing.snapshot.phase !== "error") {
    throw new Error("Provider failures must become serializable action results");
  }
  failing.dispose();
}

// Checked by tsc, never executed.
export function checkInvalidCalls() {
  const pvp = new TicTacToe({ mode: "pvp" });
  const state = pvp.getSnapshot();
  // A runtime-selected mode yields the instance union; narrow it by mode.
  const createGame = (options: TicTacToeOptions) => new TicTacToe(options);
  const selected = createGame({ mode: "pvp", ai: undefined });
  if (selected.mode === "pvp") void selected.playMove(0);
  // An explicit undefined difficulty is accepted like an omitted one.
  new TicTacToe({ mode: "singleplayer", ai: { engine: "random" } });
  new TicTacToe({ mode: "singleplayer", ai: { engine: "random", difficulty: undefined } });
  // Caller input may omit fields that the provider normalizes with defaults.
  type Deep = AIProvider<"deep", { depth: number }, { depth?: number }>;
  const deepDefault: AIConfig<readonly [Deep]> = { engine: "deep" };
  // @ts-expect-error Caller input fields keep their declared types.
  const deepInvalid: AIConfig<readonly [Deep]> = { engine: "deep", depth: "3" };
  void deepDefault;
  void deepInvalid;
  // @ts-expect-error Provider options are tied to the registered engine identifier.
  new TicTacToe({ mode: "singleplayer", aiProviders: [choiceProvider], ai: { engine: "choice", prefer: 12 } });
  // @ts-expect-error Custom engines must be registered for this instance.
  new TicTacToe({ mode: "singleplayer", ai: { engine: "choice", prefer: "last" } });
  // @ts-expect-error The random engine has no difficulty setting.
  new TicTacToe({ mode: "singleplayer", ai: { engine: "random", difficulty: "hard" } });
  // @ts-expect-error The symbol set is closed.
  const invalidSymbol: PlayerSymbol = "Y";
  void invalidSymbol;
  // @ts-expect-error Board cells also use the closed symbol set.
  const invalidBoard: BoardSnapshot = ["Y"];
  void invalidBoard;
  // @ts-expect-error Snapshots and nested arrays are immutable.
  state.legalMoves.push(4);
  // @ts-expect-error Status is immutable.
  state.gameStatus.status = "draw";
  // @ts-expect-error Variant metadata is immutable.
  state.variant.rows = 3;
  // @ts-expect-error PvP cannot have an AI phase.
  const impossible: SnapshotFor<"pvp">["phase"] = "ai-thinking";
  void impossible;
  // @ts-expect-error Reset has been replaced by restart.
  pvp.reset();
  // @ts-expect-error Internal classes are no longer public exports.
  void core.Game;
  // @ts-expect-error Internal search functions are no longer public exports.
  void core.getBestMove;
  // @ts-expect-error Internal session constructors are no longer public exports.
  void core.SinglePlayerGame;
  // @ts-expect-error PvP exposes human input, not AI stepping.
  pvp.step();
  // @ts-expect-error Board indices must be numeric.
  pvp.playMove("4");
  // @ts-expect-error AI-vs-AI requires both configurations.
  new TicTacToe({ mode: "aivsai" });
  const ai = new TicTacToe({ mode: "aivsai", aiPlayers: [{}, {}] });
  void ai.run().then((result) => {
    if (result.status === "success") {
      // @ts-expect-error A successful run cannot contain a running game result.
      const running: "running" = result.value.status;
      void running;
    }
  });
}

void verifyConsumer().catch((error) => { throw error; });
