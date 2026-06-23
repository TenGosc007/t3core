import { defineConfig } from "tsup";

import pkg from "./package.json" with { type: "json" };

const external = Object.keys(pkg.dependencies ?? {});

const shared = {
  entry: ["src/index.ts"],
  minify: false,
  splitting: false,
  sourcemap: false,
  external,
};

export default defineConfig([
  {
    ...shared,
    format: ["cjs"],
    dts: true,
    clean: true,
  },
  {
    ...shared,
    format: ["esm"],
    dts: false,
  },
]);
