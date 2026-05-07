import { WINNING_COMBINATIONS_INDEXES } from "../constants";

/** Winner from a 9-cell row-major slice matching {@link Board} (`number` = empty slot label). */
export function getWinnerFromFields<TSymbol extends string>(
  fields: readonly (number | TSymbol)[]
): TSymbol | null {
  for (const combination of WINNING_COMBINATIONS_INDEXES) {
    const firstIdx = combination[0];
    const field = fields[firstIdx];
    const isWinningCombination = combination.every((i) => fields[i] === field);

    if (typeof field === "string" && isWinningCombination) {
      return field;
    }
  }

  return null;
}
