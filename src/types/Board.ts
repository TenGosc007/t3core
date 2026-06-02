import type { PlayerSymbol } from "./Symbol";

export type BoardField = number | PlayerSymbol;

export interface IBoard {
  fields: BoardField[];
  historySize: number;
  /** @deprecated Use `getFieldByIndex` instead. */
  getFieldByNumber: (fieldNumber: number) => BoardField;
  /** @deprecated Use `setFieldByIndex` instead. */
  setFieldByNumber: (fieldNumber: number, symbol: PlayerSymbol) => void;
  getFieldByIndex: (index: number) => BoardField;
  setFieldByIndex: (index: number, symbol: PlayerSymbol) => void;
  restoreBoardHistoryAt: (index: number) => void;
  isFull: () => boolean;
  reset: () => void;
}
