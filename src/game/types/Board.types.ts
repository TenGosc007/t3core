import type { BoardField, BoardSnapshot, PlayerSymbol } from "../contracts";

export type { BoardField, BoardSnapshot } from "../contracts";

/** Internal board storage and history contract. */
export interface IBoard {
  /** Current board state as a frozen snapshot. */
  fields: BoardSnapshot;

  /** Number of stored snapshots in the board history (excluding the initial state). */
  snapshotCount: number;

  /**
   * Returns the value of the field at the given 0-based index.
   * @throws {RangeError} When `index` is out of range or not an integer.
   */
  getFieldByIndex: (index: number) => BoardField;

  /**
   * Sets the value of the field at the given 0-based index and records the move in history.
   * @throws {RangeError} When `index` is out of range or not an integer.
   */
  setFieldByIndex: (index: number, symbol: PlayerSymbol) => void;

  /**
   * Restores the board to a historical snapshot at the given index.
   * @throws {RangeError} When `index` is out of range or not an integer.
   */
  restoreBoardHistoryAt: (index: number) => void;

  /** Returns `true` when all fields are occupied by player symbols. */
  isFull: () => boolean;

  /** Resets the board to its initial empty state. */
  reset: () => void;
}
