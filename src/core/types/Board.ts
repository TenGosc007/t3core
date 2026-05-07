import type { PlayerSymbol } from "./Symbol";

export interface IBoard {
  /** Cell value for field **1–9** (grid label shown to the player). */
  getFieldByNumber: (fieldNumber: number) => number | PlayerSymbol;
  setFieldByNumber: (fieldNumber: number, symbol: PlayerSymbol) => void;
  getFields: () => (number | PlayerSymbol)[];
  isFull: () => boolean;
  reset: () => void;
}
