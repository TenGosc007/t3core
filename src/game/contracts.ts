/** Immutable domain contracts shared by rules, AI and observable sessions. */
export type PlayerSymbol = "O" | "X";

export type BoardField = number | PlayerSymbol;
export type BoardSnapshot = readonly BoardField[];

/** Only implemented variants belong here; future names are not accepted yet. */
export type VariantId = "classic-3x3";

/** Resolved metadata, not a configuration object accepted by the constructor. */
export type VariantDescriptor = {
  readonly id: string;
  readonly rows: number;
  readonly columns: number;
  readonly winLength: number;
  readonly lineRule: "at-least" | "exact";
};

export type RunningGameStatus = { readonly status: "running" };

export type FinishedGameStatus =
  | { readonly status: "win"; readonly winner: PlayerSymbol }
  | { readonly status: "draw" };

export type GameStatus = RunningGameStatus | FinishedGameStatus;
