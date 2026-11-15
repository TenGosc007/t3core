import { defineConfig } from "tsup";

import pkg from "./package.json" with { type: "json" };

const external = Object.keys(pkg.dependencies ?? {});

export default defineConfig({
  entry: ["src/index.ts"],
  minify: false,
  splitting: false,
  sourcemap: false,
  external,
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
});
