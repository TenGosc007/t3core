import type { IBoard } from "./types/Board";
import type { PlayerSymbol } from "./types/Symbol";

const fillFields = (_: number | PlayerSymbol, idx: number) => idx + 1;

export const BOARD_SIZE = 9;

export class Board implements IBoard {
  private _fields: (number | PlayerSymbol)[] = new Array(BOARD_SIZE)
    .fill(0)
    .map(fillFields);
  private _snapshot: (number | PlayerSymbol)[] | null = null;

  /**
   * Returns a stable snapshot of the current board state.
   * The same array reference is returned on repeated calls until a field is
   * mutated or the board is reset, making it safe for referential-equality
   * checks (e.g. `useSyncExternalStore`).
   * @returns A cached shallow copy of the board fields.
   */
  get fields() {
    if (!this._snapshot) {
      this._snapshot = [...this._fields];
    }
    return this._snapshot;
  }

  /**
   * Returns the value of a field by its number.
   * @param fieldNumber The field number (1-9) to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   * @deprecated Use `getFieldByIndex` instead.
   */
  getFieldByNumber(fieldNumber: number) {
    return this._fields[fieldNumber - 1];
  }

  /**
   * Returns the value of a field by its index.
   * @param index The index of the field to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   */
  getFieldByIndex(index: number) {
    return this._fields[index];
  }

  /**
   * Checks if the board is full.
   * @returns `true` if the board is full, `false` otherwise.
   */
  isFull() {
    return this._fields.every((field) => typeof field === "string");
  }

  /**
   * Sets a field's value by its number.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param fieldNumber The field number (1-9) to set.
   * @param symbol The symbol to set.
   * @deprecated Use `setFieldByIndex` instead.
   */
  setFieldByNumber(fieldNumber: number, symbol: PlayerSymbol) {
    this._fields[fieldNumber - 1] = symbol;
    this._snapshot = null;
  }

  /**
   * Sets a field's value by its index.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   * @param index The index of the field to set.
   * @param symbol The symbol to set.
   */
  setFieldByIndex(index: number, symbol: PlayerSymbol) {
    this._fields[index] = symbol;
    this._snapshot = null;
  }

  /**
   * Resets the board to its initial state.
   * Invalidates the cached snapshot so the next `fields` access returns a new reference.
   */
  reset() {
    this._fields = new Array(BOARD_SIZE).fill(0).map(fillFields);
    this._snapshot = null;
  }
}
