// @ts-check
import { existsSync } from "node:fs";
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// The example app is a separate npm project. Its files are linted once it is installed (`npm run e2e`
// installs it; the e2e workflow lints it); before that its imports cannot be typed.
const isExampleAppInstalled = existsSync(new URL("examples/next-app/node_modules", import.meta.url));

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "coverage/**",
    // Installed skills (git-ignored, managed by @softure-ai/skills); not our source.
    ".claude/**",
    "examples/*/.next/**",
    "examples/*/next-env.d.ts",
    "examples/*/test-results/**",
    "examples/*/playwright-report/**",
    ...(isExampleAppInstalled ? [] : ["examples/**"]),
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
    files: ["**/src/server/**", "**/src/ui/**", "**/src/pages/**"],
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
