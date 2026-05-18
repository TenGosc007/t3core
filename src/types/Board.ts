import type { PlayerSymbol } from "./Symbol";

export type BoardField = number | PlayerSymbol;

export interface IBoard {
  fields: BoardField[];
  /** @deprecated Use `getFieldByIndex` instead. */
  getFieldByNumber: (fieldNumber: number) => BoardField;
  /** @deprecated Use `setFieldByIndex` instead. */
  setFieldByNumber: (fieldNumber: number, symbol: PlayerSymbol) => void;
  getFieldByIndex: (index: number) => BoardField;
  setFieldByIndex: (index: number, symbol: PlayerSymbol) => void;
  isFull: () => boolean;
  reset: () => void;
}
