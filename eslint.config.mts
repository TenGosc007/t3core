import js from "@eslint/js";
import { importX } from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "path";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  {
    plugins: {
      "import-x": importX,
      perfectionist,
    },
    settings: {
      "import-x/internal-regex": "^@/",
      "import-x/resolver": {
        typescript: true,
      },
    },
    rules: {
      "no-case-declarations": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
      "perfectionist/sort-imports": [
        "error",
        {
          type: "alphabetical",
          order: "asc",
          ignoreCase: true,
          newlinesBetween: 1,
          tsconfig: { rootDir: "." },
          internalPattern: ["^@/"],
          groups: [
            "type-import",
            ["value-builtin", "value-external"],
            "value-internal",
            ["value-parent", "value-sibling", "value-index"],
            "side-effect",
            "unknown",
          ],
        },
      ],
      "import-x/no-cycle": [
        "error",
        {
          ignoreExternal: true,
        },
      ],
    },
  },
]);
