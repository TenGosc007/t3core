import type { AIStrategy } from "./types";
import type { MoveContext, MoveStrategy } from "@/ai/types";
import type { VariantDescriptor } from "@/game/contracts";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameRules } from "@/strategies/strategies.types";

/** Bridges the transitional direct-session strategy API to the provider contract. */
export class ProviderMoveStrategy implements MoveStrategy {
  private _disposed = false;

  constructor(
    private readonly _strategy: AIStrategy,
    private readonly _variant: VariantDescriptor,
    private readonly _rules: GameRules,
  ) {}

  calculateMove(
    board: BoardSnapshot,
    context: MoveContext,
    request: { readonly signal: AbortSignal } = { signal: new AbortController().signal },
  ): Promise<number> {
    if (this._disposed) throw new Error("AI strategy is disposed.");
    const { aiSymbol, opponentSymbol } = context;
    if ((aiSymbol !== "O" && aiSymbol !== "X") ||
        (opponentSymbol !== "O" && opponentSymbol !== "X")) {
      throw new RangeError("Provider strategies require O/X symbols.");
    }
    return this._strategy.calculateMove(Object.freeze({
      board, aiSymbol, opponentSymbol,
      gameStatus: Object.freeze({ ...context.gameStatus }),
      variant: this._variant,
      rules: this._rules,
    }), Object.freeze({ signal: request.signal }));
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._strategy.dispose();
  }
}
