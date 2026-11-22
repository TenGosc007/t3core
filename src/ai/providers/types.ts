import type { PlayerSymbol, VariantDescriptor } from "@/game/contracts";
import type { BoardSnapshot } from "@/game/types/Board.types";
import type { GameStatus } from "@/game/types/Game.types";
import type { GameRules } from "@/strategies/strategies.types";

/** Frozen position and simulation rules supplied to one AI calculation. */
export type AIInput = {
  /** Frozen row-major board. Make a private copy before simulating moves. */
  readonly board: BoardSnapshot;
  /** O/X symbol whose legal move must be selected. */
  readonly aiSymbol: PlayerSymbol;
  /** The other fixed O/X symbol. */
  readonly opponentSymbol: PlayerSymbol;
  /** Result of the supplied position. */
  readonly gameStatus: Readonly<GameStatus>;
  /** Resolved board dimensions and winning-line rules. */
  readonly variant: VariantDescriptor;
  /** Stateless simulation functions; these cannot be structured-cloned into a Worker. */
  readonly rules: GameRules;
};

/** Per-calculation cancellation context; completed requests are detached before later actions. */
export type AIRequest = {
  /** Aborted by stop, restart, valid undo or disposal. Remove listeners on completion. */
  readonly signal: AbortSignal
};

/** One privately owned, lazily initialized engine per AI player. */
export interface AIStrategy {
  /**
   * Selects a move without mutating the input. Initialize expensive resources
   * lazily here, and stop or discard this request's work when its signal aborts.
   * A newer request may begin immediately after cancellation; isolate its results.
   * @param input - Frozen position, symbols, variant and stateless simulation rules.
   * @param request - Distinct AbortSignal for this calculation.
   * @returns A promise for a legal zero-based cell index, validated again by the session.
   * @throws Reject with AIProviderError for initialization/timeout failures, or
   * another error for ai_failed. Invalid returned indices produce illegal_ai_move.
   */
  calculateMove(input: AIInput, request: AIRequest): Promise<number>;
  /**
   * Synchronously releases all owned resources, including Workers and listeners.
   * The session calls this once on permanent disposal, including rollback after
   * another player's construction fails. Stop/restart/undo retain this strategy.
   */
  dispose(): void;
}

/** Engine identity, compatibility and difficulty profiles for capability discovery. */
export type AIEngineMetadata = {
  /** Nonempty engine ID, unique within the game, including built-in IDs. */
  readonly id: string;
  /** Nonempty engine behavior version, independent of the t3core package version. */
  readonly version: string;
  /** Complete variant IDs supported by this engine, including their winning rules. */
  readonly supportedVariants: readonly string[];
  /** Accepted difficulty names; use an empty array for engines without profiles. */
  readonly difficulties: readonly string[];
  /** Member of difficulties used when omitted, or null when difficulties is empty. */
  readonly defaultDifficulty: string | null;
};

/**
 * Registers a custom engine through aiProviders. Keep Id a string literal so
 * configuration types associate engine IDs with the correct options.
 * Metadata discovery never calls validateOptions() or create().
 */
export interface AIProvider<Id extends string = string, Options extends object = object> {
  /** Nonempty engine ID, unique within the game, including built-in IDs. */
  readonly id: Id;
  /** Nonempty engine behavior version, independent of the t3core package version. */
  readonly version: string;
  /** Complete variant IDs supported by this engine, including their winning rules. */
  readonly supportedVariants: readonly string[];
  /** Accepted difficulty names; use an empty array for engines without profiles. */
  readonly difficulties: readonly string[];
  /** Member of difficulties used when omitted, or null when difficulties is empty. */
  readonly defaultDifficulty: string | null;
  /**
   * Validates and normalizes options without allocating engine resources.
   * The catalog checks compatibility and difficulty first and supplies the default
   * difficulty. Both AI-vs-AI players are validated before either factory runs.
   * @param options - Engine options with engine removed and default difficulty supplied.
   * @returns Typed normalized options; copy mutable data that the engine retains.
   * @throws Throw synchronously for invalid engine-specific options.
   */
  validateOptions(options: unknown): Options;
  /**
   * Creates a fresh, privately owned strategy for one player in one session.
   * This factory is synchronous; defer expensive initialization to calculateMove().
   * @param options - The normalized result of validateOptions().
   * @returns A new strategy whose resources are owned and disposed by the session.
   * @throws Clean up partially allocated resources before throwing; construction errors propagate.
   */
  create(options: Options): AIStrategy;
}

export type ProviderConfig<Provider> =
  Provider extends AIProvider<infer Id, infer Options>
    ? Readonly<Options> & { readonly engine: Id }
    : never;
