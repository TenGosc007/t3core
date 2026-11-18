import type {
  AIProvider,
  AIRequest,
  GameCapabilities,
  GameRules,
  AivsAiInstance,
  GameEventPayload,
  IGame,
  MoveStrategy,
  PvPInstance,
  SessionSnapshot,
  StartResult,
  RestartResult,
  StopResult,
  UndoResult,
  SnapshotFor,
} from "t3core";

import {
  Game,
  GameEvent,
  PlayerMoveStatus,
  RandomStrategy,
  SinglePlayerGame,
  TicTacToe,
} from "t3core";

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
        const moves = input.rules.getLegalMoves(input.board, input.aiSymbol);
        const index = prefer === "first" ? moves[0] : moves[moves.length - 1];
        if (index === undefined) throw new Error("No legal moves");
        return index;
      },
      dispose() { providerDisposals++; },
    };
  },
};

async function verifyConsumer() {
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

  const game: IGame = new Game();
  let observed: GameEventPayload | undefined;
  game.on(GameEvent.STATE_CHANGE, (snapshot) => { observed = snapshot; });
  if (game.savePlayerMove(4) !== PlayerMoveStatus.SUCCESS || observed?.board[4] !== "O") {
    throw new Error("Game exports or typed event callbacks do not work");
  }

  const pvp: PvPInstance = new TicTacToe({ mode: "pvp" });
  const { getSnapshot, subscribe } = pvp;
  const initial: SnapshotFor<"pvp"> = getSnapshot();
  const observedStates: SessionSnapshot[] = [];
  const unsubscribe = subscribe(() => observedStates.push(getSnapshot()));
  await pvp.start();
  if (getSnapshot().phase !== "human-turn" || getSnapshot().board !== initial.board) {
    throw new Error("Session phase or snapshot reference stability is broken");
  }
  const result = await pvp.playMove(4);
  if (result.status !== "success" || pvp.board[4] !== "O") {
    throw new Error("PvP facade does not work");
  }

  if (observedStates.length !== 2 || getSnapshot() !== pvp.snapshot ||
      !Object.isFrozen(pvp.snapshot) || !Object.isFrozen(pvp.snapshot.legalMoves)) {
    throw new Error("Bound snapshot observation or immutability is broken");
  }
  unsubscribe();
  const restarted: RestartResult = await pvp.restart();
  if (restarted.status !== "success" || pvp.getSnapshot().phase !== "human-turn") {
    throw new Error("Restart did not start the new game");
  }
  const started: StartResult = await pvp.start();
  const stopped: StopResult = pvp.stop();
  const undone: UndoResult = pvp.undo();
  if (started.status !== "success" || stopped.status !== "success" ||
      undone.status !== "rejected" || undone.reason !== "no_history") {
    throw new Error("Lifecycle action declarations or results are broken");
  }
  pvp.dispose();
  if (observedStates.length !== 2) throw new Error("Subscription cleanup is broken");

  const strategy: MoveStrategy = new RandomStrategy({ seed: 1 });
  const index = await strategy.calculateMove(game.board, {
    aiSymbol: "X",
    opponentSymbol: "O",
    gameStatus: game.gameStatus,
  });
  if (typeof game.board[index] !== "number") {
    throw new Error("Strategy did not return a legal move");
  }

  const ai: AivsAiInstance = new TicTacToe({
    mode: "aivsai",
    aiPlayers: [{ engine: "random", seed: 1 }, { engine: "random", seed: 2 }],
  });
  const completed = await ai.run();
  if (completed.status !== "success" || completed.value.status === undefined) {
    throw new Error("AI facade does not return a terminal result");
  }
  const terminal: "win" | "draw" = completed.value.status;
  if (terminal !== ai.gameStatus.status) throw new Error("AI result and snapshot disagree");
  if (ai.undo().status !== "success" || ai.getSnapshot().phase !== "ai-ready") {
    throw new Error("AI undo did not stop at a ready position");
  }
  ai.dispose();
  if ((await ai.run()).status !== "rejected") throw new Error("Disposed AI session accepted work");
  const failing = new SinglePlayerGame({
    game: new Game(), humanSymbol: "X", aiSymbol: "O",
    strategy: { calculateMove: async () => { throw new Error("Provider failure"); } },
  });
  const failed = await failing.start();
  if (failed.status !== "error" || failed.error.code !== "ai_failed" ||
      failing.getSnapshot().phase !== "error") {
    throw new Error("AI failure did not return a session error action");
  }
  failing.dispose();

}

// These calls must be rejected during type checking, without executing them.
export function checkInvalidCalls() {
  const rules: GameRules = new Game().rules;
  // @ts-expect-error Simulation rules are read-only, including their operations.
  rules.getLegalMoves = () => [];
  // @ts-expect-error Provider options are tied to the registered engine identifier.
  new TicTacToe({ mode: "singleplayer", aiProviders: [choiceProvider], ai: { engine: "choice", prefer: 12 } });
  // @ts-expect-error Custom engines must be registered for this instance.
  new TicTacToe({ mode: "singleplayer", ai: { engine: "choice", prefer: "last" } });
  // @ts-expect-error The random engine has no difficulty setting.
  new TicTacToe({ mode: "singleplayer", ai: { engine: "random", difficulty: "hard" } });
  const pvp = new TicTacToe({ mode: "pvp" });
  const state = pvp.getSnapshot();
  // @ts-expect-error Snapshots and their nested arrays are immutable.
  state.legalMoves.push(4);
  // @ts-expect-error Variant metadata is immutable.
  state.variant.rows = 3;
  // @ts-expect-error A PvP snapshot cannot have an AI phase.
  const impossible: SnapshotFor<"pvp">["phase"] = "ai-thinking";
  void impossible;
  if (state.phase === "finished") {
    // @ts-expect-error A finished snapshot cannot have a running result.
    const running: "running" = state.gameStatus.status;
    void running;
  }
  // @ts-expect-error Stop returns its action result synchronously.
  const stopPromise: Promise<StopResult> = pvp.stop();
  void stopPromise;
  const stopped = pvp.stop();
  if (stopped.status === "success") {
    // @ts-expect-error Stop success has no numeric value.
    const value: number = stopped.value;
    void value;
  }
  const ai = new TicTacToe({ mode: "aivsai", aiPlayers: [{}, {}] });
  void ai.run().then((result) => {
    if (result.status === "success") {
      // @ts-expect-error A successful run cannot contain a running result.
      const running: "running" = result.value.status;
      void running;
    }
  });
  // @ts-expect-error PvP instances do not expose AI-only methods.
  pvp.step();
  // @ts-expect-error Board indices must be numbers.
  pvp.playMove("4");
  // @ts-expect-error AI-vs-AI requires both AI configurations.
  new TicTacToe({ mode: "aivsai" });
}

void verifyConsumer().catch((error) => { throw error; });
