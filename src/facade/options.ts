import type { AIProvider, ProviderConfig } from "@/ai/providers/types";
import type { PlayerSymbol, VariantId } from "@/game/contracts";

/**
 * Selects a built-in or registered AI engine and its engine-specific options.
 * Omitted engine selects alpha-beta at normal difficulty. Random has no difficulty.
 * Finite seeds reproduce move sequences; restart does not rewind them.
 */
export type AIConfig<Providers extends readonly AIProvider[] = readonly []> =
  | {
    /** Built-in alpha-beta search; the default engine when omitted. */
    readonly engine?: "alphabeta";
    /** Search preset: normal (default) or hard. Neither guarantees perfect play. */
    readonly difficulty?: "normal" | "hard";
    /** Finite numeric seed; omitted means Math.random. Restart keeps the sequence. */
    readonly seed?: number
  }
  | {
    /** Chooses uniformly among legal cells without search. */
    readonly engine: "random";
    /** Omit this key for random selection. */
    readonly difficulty?: never;
    /** Finite numeric seed; omitted means Math.random. Restart keeps the sequence. */
    readonly seed?: number
  }
  | ProviderConfig<Providers[number]>;

type BaseOptions<Providers extends readonly AIProvider[]> = {
  /** Variant identifier; defaults to classic-3x3, currently the only supported variant. */
  readonly variant?: VariantId;
  /** Additional providers local to this game; IDs must be unique, including built-ins. */
  readonly aiProviders?: Providers;
};

/** Configuration for local human-vs-human play. AI options are not accepted. */
export type PvpOptions<Providers extends readonly AIProvider[] = readonly []> = BaseOptions<Providers> & {
  /** Selects local human-vs-human play. */
  readonly mode: "pvp";
  readonly humanSymbol?: never;
  readonly ai?: never;
  readonly aiPlayers?: never;
};

/** Configuration for one human against one AI engine. */
export type SinglePlayerOptions<Providers extends readonly AIProvider[] = readonly []> = BaseOptions<Providers> & {
  /** Selects human-vs-AI play with automatic AI replies. */
  readonly mode: "singleplayer";
  /** Human symbol; defaults to O. With X, start() awaits the AI opening. */
  readonly humanSymbol?: PlayerSymbol;
  /** AI engine and options; defaults to alpha-beta at normal difficulty. */
  readonly ai?: AIConfig<NoInfer<Providers>>;
  readonly aiPlayers?: never;
};

/** Configuration for two independently selected AI players. */
export type AivsAiOptions<Providers extends readonly AIProvider[] = readonly []> = BaseOptions<Providers> & {
  /** Selects AI-vs-AI play controlled through step() and run(). */
  readonly mode: "aivsai";
  /** Exactly two configurations: O first, X second. Each owns a private engine instance. */
  readonly aiPlayers: readonly [AIConfig<NoInfer<Providers>>, AIConfig<NoInfer<Providers>>];
  readonly humanSymbol?: never;
  readonly ai?: never;
};

/** Mode-specific game configuration accepted by the TicTacToe constructor. */
export type TicTacToeOptions<Providers extends readonly AIProvider[] = readonly []> =
  | PvpOptions<Providers> | SinglePlayerOptions<Providers> | AivsAiOptions<Providers>;

// Infer only these keys, so constructor calls still check for unknown option names.
type EngineSelection<Config> = {
  readonly [Key in keyof Config & ("engine" | "difficulty")]?: Config[Key];
} | { readonly engine?: string; readonly difficulty?: unknown };

type RandomWithDifficulty<Config> =
  Config extends { readonly engine: "random"; readonly difficulty: unknown } ? Config : never;

/** Checks key presence even when optional properties allow explicit undefined. */
export type CheckedAIOptions<Single, O = unknown, X = unknown> = {
  readonly ai?: EngineSelection<Single>;
  readonly aiPlayers?: { readonly 0: EngineSelection<O>; readonly 1: EngineSelection<X> };
} & ([RandomWithDifficulty<NoInfer<Single>> |
      RandomWithDifficulty<NoInfer<O>> |
      RandomWithDifficulty<NoInfer<X>>] extends [never] ? unknown : never);
