/** Release every owned strategy even if another strategy's cleanup throws. */
export function disposeStrategies(strategies: readonly { dispose?(): void }[]): void {
  const failures: unknown[] = [];
  for (const strategy of new Set(strategies)) {
    try { strategy.dispose?.(); } catch (error) { failures.push(error); }
  }
  if (failures.length > 0) throw failures[0];
}
