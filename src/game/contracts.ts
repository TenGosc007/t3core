/**
 * Immutable O/X domain data used by session snapshots. The low-level Game
 * retains its existing broader types until the domain migration.
 */
export type PlayerSymbol = "O" | "X";

export type BoardSnapshot = readonly (number | PlayerSymbol)[];

/** Only implemented variants belong here; future names are not accepted yet. */
export type VariantId = "classic-3x3";

/** Resolved metadata, not a configuration object accepted by the constructor. */
export type VariantDescriptor = {
  readonly id: VariantId;
  readonly rows: 3;
  readonly columns: 3;
  readonly winLength: 3;
  readonly lineRule: "at-least";
};

export type RunningGameStatus = { readonly status: "running" };

export type FinishedGameStatus =
  | { readonly status: "win"; readonly winner: PlayerSymbol }
  | { readonly status: "draw" };

export type GameStatus = RunningGameStatus | FinishedGameStatus;
