import type { BoardField, IBoard } from "./types/Board";
import type { PlayerSymbol } from "./types/Symbol";

import { getLastArrayItem } from "./utils/getLastArrayItem";

const fillFields = (_: BoardField, idx: number) => idx + 1;

export const BOARD_SIZE = 9;

export class Board implements IBoard {
  private readonly _size: number;
  private _snapshot: BoardField[] | null = null;
  private _boardSnapshots: BoardField[][];
  private _curretnFields: BoardField[];

  constructor(size: number = BOARD_SIZE) {
    this._size = size;
    this._boardSnapshots = [new Array(this._size).fill(0).map(fillFields)];
    this._curretnFields = getLastArrayItem(this._boardSnapshots);
  }

  /**
   * Returns a stable snapshot of the current board state.
   * The same array reference is returned on repeated calls until a field is
   * mutated or the board is reset, making it safe for referential-equality
   * checks (e.g. `useSyncExternalStore`).
   * @returns A cached shallow copy of the board fields.
   */
  get fields() {
    if (!this._snapshot) {
      this._snapshot = [...this._curretnFields];
    }
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
    return this._curretnFields[fieldNumber - 1];
  }

  /**
   * Returns the value of a field by its index.
   * @param index The index of the field to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   */
  getFieldByIndex(index: number) {
    return this._curretnFields[index];
  }

  /**
   * Checks if the board is full.
   * @returns `true` if the board is full, `false` otherwise.
   */
  isFull() {
    return this._curretnFields.every((field) => typeof field === "string");
  }

  /**
   * Sets a field's value by its number.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param fieldNumber The field number (1-9) to set.
   * @param symbol The symbol to set.
   * @deprecated Use `setFieldByIndex` instead.
   */
  setFieldByNumber(fieldNumber: number, symbol: PlayerSymbol) {
    this._curretnFields[fieldNumber - 1] = symbol;
    this._snapshot = null;
  }

  /**
   * Sets a field's value by its index and updates the board history.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param index The index of the field to set.
   * @param symbol The symbol to set.
   */
  setFieldByIndex(index: number, symbol: PlayerSymbol) {
    const newFields = [...this._curretnFields];
    newFields[index] = symbol;
    this._boardSnapshots.push(newFields);
    this._curretnFields = newFields;
    this._snapshot = null;
  }

  /**
   * Restores the board to a historical state at the given index.
   * All history entries after `index` are discarded, and the current fields
   * are updated to the entry at `index`. Invalidates the cached snapshot.
   * @param index The history index to restore (0-based).
   */
  restoreBoardHistoryAt(index: number) {
    this._boardSnapshots.splice(index + 1);
    this._curretnFields = getLastArrayItem(this._boardSnapshots);
    this._snapshot = null;
  }

  /**
   * Resets the board to its initial state.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   */
  reset() {
    this._boardSnapshots = [new Array(this._size).fill(0).map(fillFields)];
    this._curretnFields = getLastArrayItem(this._boardSnapshots);
    this._snapshot = null;
  }
}
