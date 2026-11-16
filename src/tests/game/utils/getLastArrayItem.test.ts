import { expect, test } from "vitest";

import { getLastArrayItem } from "@/game/utils/getLastArrayItem";

test("getLastArrayItem: returns the last element of an array", () => {
  expect(getLastArrayItem([1, 2, 3])).toBe(3);
});

test("getLastArrayItem: works with a single-element array", () => {
  expect(getLastArrayItem(["only"])).toBe("only");
});

test("getLastArrayItem: throws RangeError on empty array", () => {
  expect(() => getLastArrayItem([])).toThrow(RangeError);
});

test("getLastArrayItem: preserves undefined as a valid last element", () => {
  expect(getLastArrayItem([1, undefined])).toBeUndefined();
  expect(getLastArrayItem([undefined])).toBeUndefined();
});

test("getLastArrayItem: does not mutate the array", () => {
  const values = [1, 2, 3];
  expect(getLastArrayItem(values)).toBe(3);
  expect(values).toEqual([1, 2, 3]);
});
