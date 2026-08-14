import type { BoardField, BoardSnapshot, IBoard } from "./types/Board.types";
import type { PlayerSymbol } from "./types/Symbol.types";

import { getLastArrayItem } from "../utils/getLastArrayItem";

const fillFields = (_: BoardField, idx: number) => idx + 1;

export const BOARD_SIZE = 9;

/**
 * Mutable board implementation with built-in history/snapshot support.
 *
 * Exposes read-only snapshots via {@link fields} and records every mutation
 * so that previous states can be restored with {@link restoreBoardHistoryAt}.
 *
 * All index/field-number accessors validate their input and throw `RangeError`
 * on out-of-range or non-integer values. This guards the board's internal
 * invariants; callers that prefer status codes should validate at the `Game`
 * layer (e.g. via `PlayerMoveStatus.INVALID_INDEX`).
 */
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

  private _isFieldNumberValid(fieldNumber: number) {
    return (
      Number.isInteger(fieldNumber) &&
      fieldNumber >= 1 &&
      fieldNumber <= this._size
    );
  }

  private _isIndexValid(index: number) {
    return Number.isInteger(index) && index >= 0 && index < this._size;
  }

  private _isHistoryIndexValid(index: number) {
    return Number.isInteger(index) && index >= 0 && index <= this.snapshotCount;
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
    return this._snapshot!;
  }

  /**
   * Returns the number of snapshots stored in the board history.
   */
  get snapshotCount() {
    return this._boardSnapshots.length - 1;
  }

  /**
   * Returns the value of a field by its 1-based field number.
   * @param fieldNumber The field number (1-9) to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   * @throws {RangeError} When `fieldNumber` is out of range or not an integer.
   * @deprecated Use `getFieldByIndex` instead. Will be removed in v2.0.
   */
  getFieldByNumber(fieldNumber: number) {
    if (!this._isFieldNumberValid(fieldNumber)) {
      throw new RangeError(
        `fieldNumber must be an integer in [1, ${this._size}], got: ${fieldNumber}`,
      );
    }
    return this._currentFields[fieldNumber - 1];
  }

  /**
   * Returns the value of a field by its index.
   * @param index The index of the field to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   * @throws {RangeError} When `index` is out of range or not an integer.
   */
  getFieldByIndex(index: number) {
    if (!this._isIndexValid(index)) {
      throw new RangeError(
        `index must be an integer in [0, ${this._size - 1}], got: ${index}`,
      );
    }
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
   * Sets a field's value by its 1-based field number.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param fieldNumber The field number (1-9) to set.
   * @param symbol The symbol to set.
   * @throws {RangeError} When `fieldNumber` is out of range or not an integer.
   * @deprecated Use `setFieldByIndex` instead. Will be removed in v2.0.
   */
  setFieldByNumber(fieldNumber: number, symbol: PlayerSymbol) {
    if (!this._isFieldNumberValid(fieldNumber)) {
      throw new RangeError(
        `fieldNumber must be an integer in [1, ${this._size}], got: ${fieldNumber}`,
      );
    }
    this._currentFields[fieldNumber - 1] = symbol;
    this._snapshot = null;
  }

  /**
   * Sets a field's value by its index and updates the board history.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param index The index of the field to set.
   * @param symbol The symbol to set.
   * @throws {RangeError} When `index` is out of range or not an integer.
   */
  setFieldByIndex(index: number, symbol: PlayerSymbol) {
    if (!this._isIndexValid(index)) {
      throw new RangeError(
        `index must be an integer in [0, ${this._size - 1}], got: ${index}`,
      );
    }

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
   * @throws {RangeError} When `index` is out of range or not an integer.
   */
  restoreBoardHistoryAt(index: number) {
    if (!this._isHistoryIndexValid(index)) {
      throw new RangeError(
        `history index must be an integer in [0, ${this.snapshotCount}], got: ${index}`,
      );
    }
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
