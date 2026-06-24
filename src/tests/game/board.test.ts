import { expect, test } from "vitest";

import { Board, BOARD_SIZE } from "../../game/Board";

const emptyBoard = () => new Array(9).fill(0).map((_, i) => i + 1);

test("BOARD_SIZE is 9", () => {
  expect(BOARD_SIZE).toBe(9);
});

test("Board initializes with numeric fields 1-9", () => {
  const board = new Board();
  expect(board.fields).toEqual(emptyBoard());
});

test("Board initializes with custom size", () => {
  const board = new Board(4);
  expect(board.fields).toEqual([1, 2, 3, 4]);
  expect(board.fields.length).toBe(4);
});

test("fields snapshot is frozen", () => {
  const board = new Board();
  expect(Object.isFrozen(board.fields)).toBe(true);
});

test("fields returns stable reference between mutations", () => {
  const board = new Board();
  const ref1 = board.fields;
  const ref2 = board.fields;
  expect(ref1).toBe(ref2);
});

test("fields returns new reference after setFieldByIndex", () => {
  const board = new Board();
  const before = board.fields;
  board.setFieldByIndex(0, "O");
  expect(board.fields).not.toBe(before);
});

test("snapshotCount starts at 0", () => {
  const board = new Board();
  expect(board.snapshotCount).toBe(0);
});

test("snapshotCount increments after setFieldByIndex", () => {
  const board = new Board();
  board.setFieldByIndex(0, "O");
  expect(board.snapshotCount).toBe(1);
  board.setFieldByIndex(1, "X");
  expect(board.snapshotCount).toBe(2);
});

test("getFieldByIndex returns correct field", () => {
  const board = new Board();
  expect(board.getFieldByIndex(0)).toBe(1);
  board.setFieldByIndex(0, "O");
  expect(board.getFieldByIndex(0)).toBe("O");
});

test("getFieldByNumber returns correct field (1-based)", () => {
  const board = new Board();
  expect(board.getFieldByNumber(1)).toBe(1);
  board.setFieldByNumber(1, "X");
  expect(board.getFieldByNumber(1)).toBe("X");
});

test("setFieldByNumber mutates field in place without history", () => {
  const board = new Board();
  board.setFieldByNumber(5, "O");
  expect(board.getFieldByNumber(5)).toBe("O");
  expect(board.snapshotCount).toBe(0);
});

test("isFull returns false on fresh board", () => {
  const board = new Board();
  expect(board.isFull()).toBe(false);
});

test("isFull returns true when all fields are symbols", () => {
  const board = new Board(1);
  board.setFieldByIndex(0, "O");
  expect(board.isFull()).toBe(true);
});

test("restoreBoardHistoryAt restores previous state", () => {
  const board = new Board();
  board.setFieldByIndex(0, "O");
  board.setFieldByIndex(1, "X");
  board.restoreBoardHistoryAt(1);
  expect(board.getFieldByIndex(0)).toBe("O");
  expect(board.getFieldByIndex(1)).toBe(2);
});

test("restoreBoardHistoryAt invalidates snapshot cache", () => {
  const board = new Board();
  board.setFieldByIndex(0, "O");
  const after = board.fields;
  board.restoreBoardHistoryAt(0);
  expect(board.fields).not.toBe(after);
});

test("setFieldByIndex after restoreBoardHistoryAt truncates future history", () => {
  const board = new Board();
  board.setFieldByIndex(0, "O");
  board.setFieldByIndex(1, "X");
  expect(board.snapshotCount).toBe(2);
  board.restoreBoardHistoryAt(1);
  board.setFieldByIndex(2, "O");
  expect(board.snapshotCount).toBe(2);
  expect(board.getFieldByIndex(1)).toBe(2);
});

test("reset restores board to initial state", () => {
  const board = new Board();
  board.setFieldByIndex(0, "O");
  board.setFieldByIndex(1, "X");
  board.reset();
  expect(board.fields).toEqual(emptyBoard());
  expect(board.snapshotCount).toBe(0);
});

test("reset invalidates snapshot cache", () => {
  const board = new Board();
  board.setFieldByIndex(0, "O");
  const before = board.fields;
  board.reset();
  expect(board.fields).not.toBe(before);
});
