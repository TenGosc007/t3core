import { expect, test } from "vitest";

import {
  AIDifficulty,
  ALPHA_BETA_CONFIG,
  MOVE_ORDER_3X3,
  mulberry32,
} from "@/ai";

test("AI barrel exposes valid configuration for every difficulty", () => {
  expect(Object.keys(ALPHA_BETA_CONFIG).sort()).toEqual(
    Object.values(AIDifficulty).sort(),
  );
  for (const config of Object.values(ALPHA_BETA_CONFIG)) {
    expect(config.maxDepth).toBeGreaterThan(0);
    expect(config.maxDepth).toBeLessThanOrEqual(9);
    expect(config.mistakeRate).toBeGreaterThanOrEqual(0);
    expect(config.mistakeRate).toBeLessThanOrEqual(1);
    expect(typeof config.deterministicTieBreak).toBe("boolean");
  }
  expect(ALPHA_BETA_CONFIG.hard.maxDepth).toBeGreaterThan(
    ALPHA_BETA_CONFIG.normal.maxDepth,
  );
  expect(ALPHA_BETA_CONFIG.hard.mistakeRate).toBeLessThan(
    ALPHA_BETA_CONFIG.normal.mistakeRate,
  );
});

test("AI move order visits the center first and every cell exactly once", () => {
  expect(MOVE_ORDER_3X3[0]).toBe(4);
  expect([...MOVE_ORDER_3X3].sort((a, b) => a - b)).toEqual(
    Array.from({ length: 9 }, (_, index) => index),
  );
});

test("exported RNG produces reproducible, advancing values in [0, 1)", () => {
  const sample = (seed: number) => {
    const rng = mulberry32(seed);
    return Array.from({ length: 20 }, () => rng());
  };
  const values = sample(1);
  expect(values).toEqual(sample(1));
  expect(values).not.toEqual(sample(2));
  expect(new Set(values).size).toBeGreaterThan(1);
  for (const value of values) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
});
