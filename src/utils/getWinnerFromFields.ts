/** Winner from a row-major board slice matching {@link Board} (`number` = empty slot label). */
export function getWinnerFromFields<TSymbol extends string>(
  fields: readonly (number | TSymbol)[],
  winningCombinations: readonly (readonly number[])[],
): TSymbol | null {
  for (const combination of winningCombinations) {
    const firstIdx = combination[0];
    const field = fields[firstIdx];
    const isWinningCombination = combination.every((i) => fields[i] === field);

    if (typeof field === "string" && isWinningCombination) {
      return field;
    }
  }

  return null;
}
