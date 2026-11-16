/**
 * Returns the last element of an array without mutating it.
 *
 * @throws {RangeError} When `arr` is empty.
 */
export const getLastArrayItem = <T>(arr: T[]): T => {
  // Iterator completion distinguishes an empty array from an undefined value.
  const last = arr.slice(-1).values().next();
  if (last.done) {
    throw new RangeError("getLastArrayItem: array must not be empty");
  }
  return last.value;
};
