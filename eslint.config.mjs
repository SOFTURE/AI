// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "coverage/**",
    // Installed skills (git-ignored, managed by @softure-ai/skills); not our source.
    ".claude/**",
  ]),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // NFR-3 / docs/02-module-standard.md §5, §8: module logic and UI stay framework-free. Only the
    // `next/` adapter may import Next.js; UI gets links through an injected `LinkComponent`.
    files: ["**/src/server/**", "**/src/ui/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "next", message: "Only src/next/ may import Next.js (NFR-3)." }],
          patterns: [{ group: ["next/*"], message: "Only src/next/ may import Next.js (NFR-3)." }],
        },
      ],
    },
  },
]);
