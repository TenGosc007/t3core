import type { MoveStrategy } from "../ai/strategy.types";
import type { Game } from "../game/Game";
import type { BoardSnapshot } from "../game/types/Board.types";
import type { GameEventPayload } from "../game/types/Game.types";
import type { PlayerSymbol } from "../game/types/Symbol.types";
import type {
  GameSessionEventPayload,
  GameSessionEventType,
  PlayMoveResult,
  RunResult,
} from "./types";

import EventEmitter from "eventemitter3";

import { MoveStrategyError } from "../ai/strategy.types";
import { PlayerMoveStatus } from "../game/types/Game.types";

type SessionHandler = (payload: Record<string, unknown>) => void;
type SessionEmitter = EventEmitter<Record<string, SessionHandler>>;

function isLegalMove(index: number, board: BoardSnapshot): boolean {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < board.length &&
    typeof board[index] !== "string"
  );
}

/**
 * AI-vs-AI session. Does NOT implement {@link GameSession} — there is no human
 * input, so `playMove(index)` makes no sense. Instead exposes `step()` (one AI
 * move) and `run()` (auto-play to the end). Useful for difficulty benchmarks
 * and regression demos.
 */
export class AIGame {
  private readonly _game: Game;
  private readonly _strategies: readonly [MoveStrategy, MoveStrategy];
  private readonly _symbols: readonly [PlayerSymbol, PlayerSymbol];
  private readonly _emitter: SessionEmitter = new EventEmitter();

  private _generation = 0;
  private _busyGeneration: number | null = null;
  private _lifecycle: "idle" | "started" | "finished" = "idle";

  constructor(options: {
    game: Game;
    strategies: [MoveStrategy, MoveStrategy]; // [player1='O', player2='X']
  }) {
    this._game = options.game;
    this._strategies = options.strategies;
    this._symbols = ["O", "X"] as const;
  }

  get board() {
    return this._game.board;
  }
  get currentPlayer() {
    return this._game.currentPlayer;
  }
  get gameStatus() {
    return this._game.gameStatus;
  }
  get snapshot() {
    return this._game.snapshot;
  }
  get movesCount() {
    return this._game.movesCount;
  }

  /** Performs one AI move for the current player. */
  async step(): Promise<PlayMoveResult> {
    if (this._busyGeneration !== null) return { status: "busy" };
    if (this._lifecycle === "finished") return { status: "game_not_running" };

    const gen = this._generation;
    this._busyGeneration = gen;
    try {
      const result = await this._performStep(gen);
      return result;
    } finally {
      if (this._busyGeneration === gen) this._busyGeneration = null;
    }
  }

  /** Auto-plays to the end, emitting `move`/`turn` per move and `finished`. */
  async run(): Promise<RunResult> {
    if (this._busyGeneration !== null) return { status: "busy" };
    if (this._lifecycle === "finished") {
      return { status: "completed", result: this._game.gameStatus };
    }

    const gen = this._generation;
    this._busyGeneration = gen;
    try {
      this._lifecycle = "started";
      while (this._game.gameStatus.status === "running") {
        const result = await this._performStep(gen);
        if (result.status === "aborted") return { status: "aborted" };
        if (result.status !== "success") {
          // Should not happen in AI-vs-AI, but be defensive.
          return { status: "completed", result: this._game.gameStatus };
        }
      }
      if (this._generation !== gen) return { status: "aborted" };
      return { status: "completed", result: this._game.gameStatus };
    } finally {
      if (this._busyGeneration === gen) this._busyGeneration = null;
    }
  }

  reset(): void {
    this._generation++;
    this._busyGeneration = null;
    this._lifecycle = "idle";
    this._game.reset();
  }

  on<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this {
    this._emitter.on(event, handler as SessionHandler);
    return this;
  }

  off<K extends GameSessionEventType>(
    event: K,
    handler: (payload: GameSessionEventPayload<K>) => void,
  ): this {
    this._emitter.off(event, handler as SessionHandler);
    return this;
  }

  private _emit<K extends GameSessionEventType>(
    event: K,
    payload: GameSessionEventPayload<K>,
  ): void {
    this._emitter.emit(event, payload as Record<string, unknown>);
  }

  /** Performs one AI move without taking the lock — `step`/`run` hold it. */
  private async _performStep(gen: number): Promise<PlayMoveResult> {
    if (this._lifecycle === "idle") this._lifecycle = "started";

    const player = this._game.currentPlayer;
    const idx = this._symbols.indexOf(player);
    const strategy = this._strategies[idx] as MoveStrategy;
    const opponent = this._symbols[(idx + 1) % 2] as PlayerSymbol;

    this._emit("ai-thinking", { player });

    let move: number;
    try {
      move = await strategy.calculateMove(this._game.board, {
        aiSymbol: player,
        opponentSymbol: opponent,
        gameStatus: this._game.gameStatus,
      });
    } catch (e) {
      if (this._generation !== gen) return { status: "aborted" };
      if (e instanceof MoveStrategyError && e.code === "no_legal_moves") {
        this._lifecycle = "finished";
        this._emit("finished", { result: this._game.gameStatus });
        return { status: "success" };
      }
      throw e;
    }

    if (this._generation !== gen) return { status: "aborted" };

    if (!isLegalMove(move, this._game.board)) {
      throw new MoveStrategyError(
        "illegal_move",
        `Strategy returned illegal index: ${move}`,
      );
    }

    const status = this._game.savePlayerMove(move);
    if (status !== PlayerMoveStatus.SUCCESS) {
      return { status: "game_not_running" };
    }

    this._emit("move", { player, position: move });

    if (this._game.gameStatus.status !== "running") {
      this._lifecycle = "finished";
      this._emit("finished", { result: this._game.gameStatus });
      return { status: "success" };
    }

    this._emit("turn", { player: this._game.currentPlayer });
    return { status: "success" };
  }
}

// Re-export for type-only consumers that want `GameEventPayload` shape.
export type { GameEventPayload };
