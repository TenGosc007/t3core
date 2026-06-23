import { defineConfig } from "tsup";

import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  minify: false,
  splitting: false,
  sourcemap: false,
  external: Object.keys(pkg.dependencies ?? {}),
});
