import type { BoardField, BoardSnapshot, IBoard } from "./types/Board.types";
import type { PlayerSymbol } from "./types/Symbol.types";

import { getLastArrayItem } from "./utils/getLastArrayItem";

const fillFields = (_: BoardField, idx: number) => idx + 1;

export const BOARD_SIZE = 9;

export class Board implements IBoard {
  private readonly _size: number;
  private _snapshot: BoardSnapshot | null = null;
  private _boardSnapshots: BoardField[][];
  private _currentFields: BoardField[];
  private _currentSnapshotIndex: number | null = null;

  constructor(size: number = BOARD_SIZE) {
    this._size = size;
    this._boardSnapshots = [new Array(this._size).fill(0).map(fillFields)];
    this._currentFields = getLastArrayItem(this._boardSnapshots);
  }

  /**
   * Returns a stable snapshot of the current board state.
   * The same array reference is returned on repeated calls until a field is
   * mutated or the board is reset, making it safe for referential-equality
   * checks (e.g. `useSyncExternalStore`).
   * @returns A cached shallow copy of the board fields.
   */
  get fields(): BoardSnapshot {
    this._snapshot ??= Object.freeze([...this._currentFields]);
    return this._snapshot;
  }

  /**
   * Returns the number of snapshots stored in the board history.
   */
  get snapshotCount() {
    return this._boardSnapshots.length - 1;
  }

  /**
   * Returns the value of a field by its number.
   * @param fieldNumber The field number (1-9) to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   * @deprecated Use `getFieldByIndex` instead.
   */
  getFieldByNumber(fieldNumber: number) {
    return this._currentFields[fieldNumber - 1];
  }

  /**
   * Returns the value of a field by its index.
   * @param index The index of the field to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   */
  getFieldByIndex(index: number) {
    return this._currentFields[index];
  }

  /**
   * Checks if the board is full.
   * @returns `true` if the board is full, `false` otherwise.
   */
  isFull() {
    return this._currentFields.every((field) => typeof field === "string");
  }

  /**
   * Sets a field's value by its number.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param fieldNumber The field number (1-9) to set.
   * @param symbol The symbol to set.
   * @deprecated Use `setFieldByIndex` instead.
   */
  setFieldByNumber(fieldNumber: number, symbol: PlayerSymbol) {
    this._currentFields[fieldNumber - 1] = symbol;
    this._snapshot = null;
  }

  /**
   * Sets a field's value by its index and updates the board history.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param index The index of the field to set.
   * @param symbol The symbol to set.
   */
  setFieldByIndex(index: number, symbol: PlayerSymbol) {
    const newFields = [...this._currentFields];
    newFields[index] = symbol;

    if (this._currentSnapshotIndex != null) {
      this._boardSnapshots = this._boardSnapshots.slice(
        0,
        this._currentSnapshotIndex + 1,
      );
    }

    this._boardSnapshots.push(newFields);
    this._currentFields = newFields;
    this._snapshot = null;
    this._currentSnapshotIndex = null;
  }

  /**
   * Restores the board to a historical state at the given index.
   * The current fields are updated to the snapshot at `index`, and future
   * moves will truncate history from this point. Invalidates the cached snapshot.
   * @param index The history index to restore (0-based).
   */
  restoreBoardHistoryAt(index: number) {
    this._currentFields = this._boardSnapshots[index];
    this._currentSnapshotIndex = index;
    this._snapshot = null;
  }

  /**
   * Resets the board to its initial state.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   */
  reset() {
    this._boardSnapshots = [new Array(this._size).fill(0).map(fillFields)];
    this._currentFields = getLastArrayItem(this._boardSnapshots);
    this._snapshot = null;
    this._currentSnapshotIndex = null;
  }
}
