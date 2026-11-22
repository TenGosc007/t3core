/** Fixed player symbols; O always starts a new game. */
export type PlayerSymbol = "O" | "X";

/** Numeric label for an empty cell, or O/X for an occupied cell. Move indices are zero-based. */
export type BoardField = number | PlayerSymbol;
/** Read-only row-major board array; snapshots supplied by the game are frozen. */
export type BoardSnapshot = readonly BoardField[];

/** Supported variant identifier. Currently only classic-3x3 is implemented. */
export type VariantId = "classic-3x3";

/** Resolved metadata, not a configuration object accepted by the constructor. */
export type VariantDescriptor = {
  /** Complete variant identifier. */
  readonly id: string;
  /** Number of board rows. */
  readonly rows: number;
  /** Number of board columns. */
  readonly columns: number;
  /** Required number of consecutive matching symbols in a winning line. */
  readonly winLength: number;
  /** Whether longer lines also win (at-least) or only exact-length lines count (exact). */
  readonly lineRule: "at-least" | "exact";
};

/** Position without a winner or draw; session phase determines whether play is enabled. */
export type RunningGameStatus = { readonly status: "running" };

/** Terminal position: a win with its winning symbol, or a draw. */
export type FinishedGameStatus =
  | { readonly status: "win"; readonly winner: PlayerSymbol }
  | { readonly status: "draw" };

/** Position result, separate from the session lifecycle phase. */
export type GameStatus = RunningGameStatus | FinishedGameStatus;
