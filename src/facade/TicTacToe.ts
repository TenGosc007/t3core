import type { MoveStrategy } from "../ai/strategy.types";
import type { PlayerSymbol } from "../game/types/Symbol.types";
import type {
  AivsAiInstance,
  AivsAiOptions,
  PvPInstance,
  PvpOptions,
  SinglePlayerInstance,
  SinglePlayerOptions,
  TicTacToeConstructor,
  TicTacToeOptions,
} from "./types";

import { AlphaBetaStrategy } from "../ai/AlphaBetaStrategy";
import { RandomStrategy } from "../ai/RandomStrategy";
import { AIDifficulty } from "../ai/types";
import { DEFAULT_GAME_SYMBOLS } from "../constants/gameConstants";
import { Game } from "../game/Game";
import { AIGame } from "../sessions/AIGame";
import { PvPGame } from "../sessions/PvPGame";
import { SinglePlayerGame } from "../sessions/SinglePlayerGame";

function buildStrategy(config: {
  engine?: "alphabeta" | "random";
  difficulty?: AIDifficulty;
  seed?: number;
}): MoveStrategy {
  const engine = config.engine ?? "alphabeta";
  if (engine === "random") return new RandomStrategy({ seed: config.seed });
  return new AlphaBetaStrategy({
    difficulty: config.difficulty ?? AIDifficulty.HARD,
    seed: config.seed,
  });
}

/**
 * Implementation of the `TicTacToe` facade. The exported `TicTacToe` constant
 * is typed as {@link TicTacToeConstructor} (overloaded construct signatures),
 * so `new TicTacToe({ mode: 'pvp' })` returns a `PvPInstance`, etc. This class
 * is not exported directly — only the typed constant is.
 */
class TicTacToeImpl {
  private readonly _session: PvPGame | SinglePlayerGame | AIGame;
  private readonly _mode: "pvp" | "singleplayer" | "aivsai";

  constructor(options: TicTacToeOptions) {
    const game = new Game({ variant: options.variant });
    const symbols = DEFAULT_GAME_SYMBOLS;

    switch (options.mode) {
      case "pvp": {
        this._session = new PvPGame({ game });
        this._mode = "pvp";
        break;
      }
      case "singleplayer": {
        const humanSymbol: PlayerSymbol = options.humanSymbol ?? symbols[0];
        const aiSymbol = humanSymbol === symbols[0] ? symbols[1] : symbols[0];
        const strategy = buildStrategy(options.ai ?? {});
        this._session = new SinglePlayerGame({
          game,
          strategy,
          humanSymbol,
          aiSymbol,
        });
        this._mode = "singleplayer";
        break;
      }
      case "aivsai": {
        const strategies: [MoveStrategy, MoveStrategy] = [
          buildStrategy(options.aiPlayers[0]),
          buildStrategy(options.aiPlayers[1]),
        ];
        this._session = new AIGame({ game, strategies });
        this._mode = "aivsai";
        break;
      }
      default: {
        // Exhaustiveness check — if a new mode is added without handling it
        // here, TypeScript flags this branch as non-never.
        const _exhaustive: never = options;
        throw new Error(
          `Unsupported mode: ${String((_exhaustive as { mode: string }).mode)}`,
        );
      }
    }
  }

  get board() {
    return this._session.board;
  }
  get currentPlayer() {
    return this._session.currentPlayer;
  }
  get gameStatus() {
    return this._session.gameStatus;
  }
  get snapshot() {
    return this._session.snapshot;
  }
  get movesCount() {
    return this._session.movesCount;
  }
  get mode() {
    return this._mode;
  }

  reset(): void {
    this._session.reset();
  }

  on(...args: never[]) {
    return this._delegateEvent("on", args);
  }
  off(...args: never[]) {
    return this._delegateEvent("off", args);
  }

  start(): Promise<unknown> {
    if (this._mode === "aivsai") {
      throw new Error("start() is not available in 'aivsai' mode.");
    }
    return (this._session as PvPGame | SinglePlayerGame).start();
  }

  playMove(index: number): Promise<unknown> {
    if (this._mode === "aivsai") {
      throw new Error("playMove() is not available in 'aivsai' mode.");
    }
    return (this._session as PvPGame | SinglePlayerGame).playMove(index);
  }

  step(): Promise<unknown> {
    if (this._mode !== "aivsai") {
      throw new Error("step() is not available in this mode.");
    }
    return (this._session as AIGame).step();
  }

  run(): Promise<unknown> {
    if (this._mode !== "aivsai") {
      throw new Error("run() is not available in this mode.");
    }
    return (this._session as AIGame).run();
  }

  private _delegateEvent(method: "on" | "off", args: never[]): this {
    const fn = this._session[method] as (...a: never[]) => unknown;
    fn.apply(this._session, args);
    return this;
  }
}

/**
 * Public facade entry point. Use as `new TicTacToe({ mode: ... })`. The
 * returned instance type depends on `mode` (see {@link TicTacToeConstructor}).
 */
export const TicTacToe: TicTacToeConstructor =
  TicTacToeImpl as unknown as TicTacToeConstructor;

// Re-export for type-only consumers.
export type {
  AivsAiInstance,
  AivsAiOptions,
  PvPInstance,
  PvpOptions,
  SinglePlayerInstance,
  SinglePlayerOptions,
  TicTacToeConstructor,
  TicTacToeOptions,
};
