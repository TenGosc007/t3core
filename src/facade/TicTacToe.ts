import type { CapabilitiesOptions, GameCapabilities } from "./catalog/types";
import type { TicTacToeConstructor, TicTacToeOptions } from "./types";
import type { AIProvider } from "@/ai/providers/types";
import type { PvPGame } from "@/sessions/PvPGame";
import type { SinglePlayerGame } from "@/sessions/SinglePlayerGame";

import { AIGame } from "@/sessions/AIGame";

import { buildSession } from "./buildSession";
import { ProviderCatalog } from "./catalog/ProviderCatalog";

/**
 * Implementation of the `TicTacToe` facade. The exported `TicTacToe` constant
 * is typed as {@link TicTacToeConstructor} (overloaded construct signatures),
 * so `new TicTacToe({ mode: 'pvp' })` returns a `PvPInstance`, etc. This class
 * is not exported directly — only the typed constant is.
 */
class TicTacToeImpl {
  private readonly _session: PvPGame | SinglePlayerGame | AIGame;
  private readonly _mode: "pvp" | "singleplayer" | "aivsai";

  constructor(options: TicTacToeOptions<readonly AIProvider[]>) {
    this._session = buildSession(options);
    this._mode = options.mode;
  }

  static getCapabilities(options: CapabilitiesOptions = {}): GameCapabilities {
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError("Capabilities options must be an object.");
    }
    for (const key of Object.keys(options)) {
      if (key !== "variant" && key !== "aiProviders") throw new TypeError("Unsupported capabilities option: " + key);
    }
    if (options.variant !== undefined && typeof options.variant !== "string") {
      throw new TypeError("Variant must be a string identifier.");
    }
    if (options.aiProviders !== undefined && !Array.isArray(options.aiProviders)) {
      throw new TypeError("aiProviders must be an array.");
    }
    return new ProviderCatalog(options.variant, options.aiProviders).capabilities();
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

  restart() { return this._session.restart(); }
  stop() { return this._session.stop(); }
  undo() { return this._session.undo(); }
  dispose(): void { this._session.dispose(); }

  readonly getSnapshot = () => this._session.getSnapshot();

  readonly subscribe = (callback: () => void): (() => void) =>
    this._session.subscribe(callback);

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
    return this._humanSession().start();
  }

  playMove(index: number): Promise<unknown> {
    if (this._mode === "aivsai") {
      throw new Error("playMove() is not available in 'aivsai' mode.");
    }
    return this._humanSession().playMove(index);
  }

  step(): Promise<unknown> {
    if (this._mode !== "aivsai") {
      throw new Error("step() is not available in this mode.");
    }
    return this._aiSession().step();
  }

  run(): Promise<unknown> {
    if (this._mode !== "aivsai") {
      throw new Error("run() is not available in this mode.");
    }
    return this._aiSession().run();
  }

  private _humanSession(): PvPGame | SinglePlayerGame {
    if (this._session instanceof AIGame) throw new Error("Human input is unavailable in AI-vs-AI.");
    return this._session;
  }

  private _aiSession(): AIGame {
    if (!(this._session instanceof AIGame)) throw new Error("AI stepping requires AI-vs-AI.");
    return this._session;
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
