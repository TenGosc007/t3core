import type { PlayMoveResult, RunResult } from "./types";
import type { MoveStrategy } from "@/ai/strategy.types";
import type { Game } from "@/game/Game";
import type { GameEventPayload } from "@/game/types/Game.types";
import type { PlayerSymbol } from "@/game/types/Symbol.types";

import { MoveStrategyError } from "@/ai/strategy.types";
import { PlayerMoveStatus } from "@/game/types/Game.types";

import { BaseSession } from "./BaseSession";
import { isLegalMove } from "./utils";

/**
 * AI-vs-AI session. Does NOT implement {@link GameSession} — there is no human
 * input, so `playMove(index)` makes no sense. Instead exposes `step()` (one AI
 * move) and `run()` (auto-play to the end). Useful for difficulty benchmarks
 * and regression demos.
 */
export class AIGame extends BaseSession {
  private readonly _strategies: readonly [MoveStrategy, MoveStrategy];
  private readonly _symbols: readonly [PlayerSymbol, PlayerSymbol];

  constructor(options: {
    game: Game;
    strategies: [MoveStrategy, MoveStrategy]; // [player1='O', player2='X']
  }) {
    super(options.game);
    this._strategies = options.strategies;
    this._symbols = ["O", "X"] as const;
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
