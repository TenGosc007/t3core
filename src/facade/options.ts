import type { AIProvider, ProviderConfig } from "@/ai/providers/types";
import type { PlayerSymbol, VariantId } from "@/game/contracts";

export type AIConfig<Providers extends readonly AIProvider[] = readonly []> =
  | { readonly engine?: "alphabeta"; readonly difficulty?: "normal" | "hard"; readonly seed?: number }
  | { readonly engine: "random"; readonly difficulty?: never; readonly seed?: number }
  | ProviderConfig<Providers[number]>;

type BaseOptions<Providers extends readonly AIProvider[]> = {
  readonly variant?: VariantId;
  readonly aiProviders?: Providers;
};

export type PvpOptions<Providers extends readonly AIProvider[] = readonly []> = BaseOptions<Providers> & {
  readonly mode: "pvp";
  readonly humanSymbol?: never;
  readonly ai?: never;
  readonly aiPlayers?: never;
};

export type SinglePlayerOptions<Providers extends readonly AIProvider[] = readonly []> = BaseOptions<Providers> & {
  readonly mode: "singleplayer";
  readonly humanSymbol?: PlayerSymbol;
  readonly ai?: AIConfig<NoInfer<Providers>>;
  readonly aiPlayers?: never;
};

export type AivsAiOptions<Providers extends readonly AIProvider[] = readonly []> = BaseOptions<Providers> & {
  readonly mode: "aivsai";
  readonly aiPlayers: readonly [AIConfig<NoInfer<Providers>>, AIConfig<NoInfer<Providers>>];
  readonly humanSymbol?: never;
  readonly ai?: never;
};

export type TicTacToeOptions<Providers extends readonly AIProvider[] = readonly []> =
  | PvpOptions<Providers> | SinglePlayerOptions<Providers> | AivsAiOptions<Providers>;
