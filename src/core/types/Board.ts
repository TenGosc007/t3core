import type { PlayerSymbol } from "./Symbol";

export interface IBoard {
  fields: (number | PlayerSymbol)[];
  getFieldByNumber: (fieldNumber: number) => number | PlayerSymbol;
  setFieldByNumber: (fieldNumber: number, symbol: PlayerSymbol) => void;
  isFull: () => boolean;
  reset: () => void;
}
