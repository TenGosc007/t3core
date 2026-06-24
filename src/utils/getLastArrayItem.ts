/** Returns the last element of an array without mutating it. */
export const getLastArrayItem = <T>(arr: T[]): T => {
  return arr[arr.length - 1];
};
