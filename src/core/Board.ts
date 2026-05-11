import type { IBoard } from "./types/Board";
import type { PlayerSymbol } from "./types/Symbol";

const fillFields = (_: number | PlayerSymbol, idx: number) => idx + 1;

export const BOARD_SIZE = 9;

export class Board implements IBoard {
  private fields: (number | PlayerSymbol)[] = new Array(BOARD_SIZE)
    .fill(0)
    .map(fillFields);

  /**
   * Returns the current board state.
   * @returns The current board state.
   * @type {number[] | PlayerSymbol[]}
   */
  getFields() {
    return [...this.fields];
  }

  /**
   * Returns the value of a field by its number.
   * @param fieldNumber The field number (1-9) to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   * @deprecated Use `getFieldByIndex` instead.
   */
  getFieldByNumber(fieldNumber: number) {
    return this.fields[fieldNumber - 1];
  }

  /**
   * Returns the value of a field by its index.
   * @param index The index of the field to get.
   * @returns The value of the field.
   * @type {number | TSymbol}
   */
  getFieldByIndex(index: number) {
    return this.fields[index];
  }

  /**
   * Checks if the board is full.
   * @returns `true` if the board is full, `false` otherwise.
   */
  isFull() {
    return this.fields.every((field) => typeof field === "string");
  }

  /**
   * Sets a field's value by its number.
   * @param fieldNumber The field number (1-9) to set.
   * @param symbol The symbol to set.
   * @deprecated Use `setFieldByIndex` instead.
   */
  setFieldByNumber(fieldNumber: number, symbol: PlayerSymbol) {
    this.fields[fieldNumber - 1] = symbol;
  }

  /**
   * Sets a field's value by its index.
   * @param index The index of the field to set.
   * @param symbol The symbol to set.
   */
  setFieldByIndex(index: number, symbol: PlayerSymbol) {
    this.fields[index] = symbol;
  }

  /**
   * Resets the board to its initial state.
   */
  reset() {
    this.fields = new Array(BOARD_SIZE).fill(0).map(fillFields);
  }
}
