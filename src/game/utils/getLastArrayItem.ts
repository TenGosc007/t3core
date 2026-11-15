/**
 * Returns the last element of an array without mutating it.
 *
 * @throws {RangeError} When `arr` is empty.
 */
export const getLastArrayItem = <T>(arr: T[]): T => {
  if (arr.length === 0) {
    throw new RangeError("getLastArrayItem: array must not be empty");
  }
  return arr[arr.length - 1];
};
