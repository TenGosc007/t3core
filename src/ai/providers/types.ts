import type { PlayerSymbol, VariantDescriptor } from "@/game/contracts";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { GameRules } from "@/strategies/strategies.types";

export type AIInput = {
  readonly board: BoardSnapshot;
  readonly aiSymbol: PlayerSymbol;
  readonly opponentSymbol: PlayerSymbol;
  readonly gameStatus: Readonly<GameStatus>;
  readonly variant: VariantDescriptor;
  readonly rules: GameRules;
};

export type AIRequest = { readonly signal: AbortSignal };

/** One privately owned, lazily initialized engine per AI player. */
export interface AIStrategy {
  calculateMove(input: AIInput, request: AIRequest): Promise<number>;
  dispose(): void;
}

export type AIEngineMetadata = {
  readonly id: string;
  readonly version: string;
  readonly supportedVariants: readonly string[];
  readonly difficulties: readonly string[];
  readonly defaultDifficulty: string | null;
};

/** Validation returns typed, normalized options without creating resources. */
export interface AIProvider<Id extends string = string, Options extends object = object> {
  readonly id: Id;
  readonly version: string;
  readonly supportedVariants: readonly string[];
  readonly difficulties: readonly string[];
  readonly defaultDifficulty: string | null;
  validateOptions(options: unknown): Options;
  create(options: Options): AIStrategy;
}

export type ProviderConfig<Provider> =
  Provider extends AIProvider<infer Id, infer Options>
    ? Readonly<Options> & { readonly engine: Id }
    : never;
