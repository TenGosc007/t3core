import type { PlayerSymbol } from "./Symbol";

export type BoardField = number | PlayerSymbol;

export interface IBoard {
  fields: BoardField[];
  getFieldByNumber: (fieldNumber: number) => BoardField;
  setFieldByNumber: (fieldNumber: number, symbol: PlayerSymbol) => void;
  isFull: () => boolean;
  reset: () => void;
}
