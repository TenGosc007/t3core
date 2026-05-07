import type { DEFAULT_GAME_SYMBOLS } from "../constants";

export type PlayerSymbols = typeof DEFAULT_GAME_SYMBOLS;
export type PlayerSymbol = PlayerSymbols[number];
