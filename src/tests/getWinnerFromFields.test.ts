import { expect, test } from "vitest";

import { getWinnerFromFields } from "../utils/getWinnerFromFields";

test("getWinnerFromFields: top row all X wins", () => {
  const fields = ["X", "X", "X", 4, 5, 6, 7, 8, 9];
  expect(getWinnerFromFields(fields)).toBe("X");
});

test("getWinnerFromFields: middle column all O wins", () => {
  const fields = [1, "O", 3, 4, "O", 6, 7, "O", 9];
  expect(getWinnerFromFields(fields)).toBe("O");
});

test("getWinnerFromFields: diagonal 0-4-8 wins", () => {
  const fields = ["X", 2, 3, 4, "X", 6, 7, 8, "X"];
  expect(getWinnerFromFields(fields)).toBe("X");
});

test("getWinnerFromFields: fresh labels — no winner", () => {
  const fields = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  expect(getWinnerFromFields(fields)).toBe(null);
});

test("getWinnerFromFields: mixed line — no winner", () => {
  const fields = ["X", "O", "X", 4, 5, 6, 7, 8, 9];
  expect(getWinnerFromFields(fields)).toBe(null);
});

test("getWinnerFromFields: middle row all X wins", () => {
  const fields = [1, 2, 3, "X", "X", "X", 7, 8, 9];
  expect(getWinnerFromFields(fields)).toBe("X");
});

test("getWinnerFromFields: bottom row all O wins", () => {
  const fields = [1, 2, 3, 4, 5, 6, "O", "O", "O"];
  expect(getWinnerFromFields(fields)).toBe("O");
});

test("getWinnerFromFields: left column all X wins", () => {
  const fields = ["X", 2, 3, "X", 5, 6, "X", 8, 9];
  expect(getWinnerFromFields(fields)).toBe("X");
});

test("getWinnerFromFields: right column all O wins", () => {
  const fields = [1, 2, "O", 4, 5, "O", 7, 8, "O"];
  expect(getWinnerFromFields(fields)).toBe("O");
});

test("getWinnerFromFields: anti-diagonal 2-4-6 wins", () => {
  const fields = [1, 2, "X", 4, "X", 6, "X", 8, 9];
  expect(getWinnerFromFields(fields)).toBe("X");
});
