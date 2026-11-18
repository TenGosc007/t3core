/** Internal v2 options for the implemented variant and built-in AI engines. */
import type { PlayerSymbol, VariantId } from "@/game/contracts";

export type AIConfig =
  | {
    readonly engine?: "alphabeta";
    readonly difficulty?: "normal" | "hard";
    readonly seed?: number;
  }
  | {
    readonly engine: "random";
    readonly difficulty?: never;
    readonly seed?: number;
  };

type BaseOptions = { readonly variant?: VariantId };

export type PvpOptions = BaseOptions & {
  readonly mode: "pvp";
  readonly humanSymbol?: never;
  readonly ai?: never;
  readonly aiPlayers?: never;
};

export type SinglePlayerOptions = BaseOptions & {
  readonly mode: "singleplayer";
  readonly humanSymbol?: PlayerSymbol;
  readonly ai?: AIConfig;
  readonly aiPlayers?: never;
};

export type AivsAiOptions = BaseOptions & {
  readonly mode: "aivsai";
  /** O starts, X follows. Each player receives a private strategy instance. */
  readonly aiPlayers: readonly [AIConfig, AIConfig];
  readonly humanSymbol?: never;
  readonly ai?: never;
};

export type TicTacToeOptions = PvpOptions | SinglePlayerOptions | AivsAiOptions;
