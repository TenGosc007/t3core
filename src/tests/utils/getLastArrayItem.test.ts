import { expect, test } from "vitest";

import { getLastArrayItem } from "../../utils/getLastArrayItem";

test("getLastArrayItem: returns the last element of an array", () => {
  expect(getLastArrayItem([1, 2, 3])).toBe(3);
});

test("getLastArrayItem: works with a single-element array", () => {
  expect(getLastArrayItem(["only"])).toBe("only");
});
