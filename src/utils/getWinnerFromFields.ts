/**
 * Detects the winner from a row-major board slice.
 *
 * Empty slots are expected to be numeric labels (`number`), and occupied slots
 * are string symbols (`TSymbol`). A combination wins only when all its fields
 * contain the same non-empty symbol.
 *
 * @param fields - Board slice matching {@link BoardSnapshot}.
 * @param winningCombinations - List of index combinations that define a win.
 * @returns The winning symbol, or `null` if there is no winner.
 */
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
