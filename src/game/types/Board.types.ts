import type { PlayerSymbol } from "./Symbol.types";

/** A single board cell: either a numeric placeholder (empty slot label) or a player symbol. */
export type BoardField = number | PlayerSymbol;

/** Read-only snapshot of the board fields, safe for external consumers and referential-equality checks. */
export type BoardSnapshot = readonly BoardField[];

/** Public contract for a Tic Tac Toe board. */
export interface IBoard {
  /** Current board state as a frozen snapshot. */
  fields: BoardSnapshot;

  /** Number of stored snapshots in the board history (excluding the initial state). */
  snapshotCount: number;

  /**
   * @deprecated Use `getFieldByIndex` instead. Will be removed in v2.0.
   */
  getFieldByNumber: (fieldNumber: number) => BoardField;

  /**
   * @deprecated Use `setFieldByIndex` instead. Will be removed in v2.0.
   */
  setFieldByNumber: (fieldNumber: number, symbol: PlayerSymbol) => void;

  /** Returns the value of the field at the given 0-based index. */
  getFieldByIndex: (index: number) => BoardField;

  /** Sets the value of the field at the given 0-based index and records the move in history. */
  setFieldByIndex: (index: number, symbol: PlayerSymbol) => void;

  /** Restores the board to a historical snapshot at the given index. */
  restoreBoardHistoryAt: (index: number) => void;

  /** Returns `true` when all fields are occupied by player symbols. */
  isFull: () => boolean;

  /** Resets the board to its initial empty state. */
  reset: () => void;
}
