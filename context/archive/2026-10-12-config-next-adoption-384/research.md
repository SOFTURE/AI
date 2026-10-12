---
change_id: config-next-adoption-384
---

# Research: config-next-adoption-384

Sources: `tools/config/{package.json,README.md,CHANGELOG.md,src/eslint/index.ts,presets/*,tests/eslint.test.ts}`,
eslint-config-next 16.4.0 `dist/index.js` and `dist/parser.js`, a scratch app (outside the repository) with
eslint 9.39.1, eslint-config-next 16.4.0, next 16, typescript-eslint 8.68.0 / 8.71.1, the built preset copied in.

- The preset's APIs: `defineConfig` and `globalIgnores` from `eslint/config` (ESLint 9.22+), `js.configs.recommended`,
  `tseslint.configs.recommendedTypeChecked` (three objects: the plugin + parser base with no `files`, the
  eslint-recommended overrides for TS files, the type-checked rules with no `files`), `globals.browser`/`node`.
  Nothing needs ESLint 10, `@eslint/js` 10, `globals` 17 or typescript-eslint 8.71.
- eslint-config-next 16.4 `core-web-vitals` config `next` sets `languageOptions.parser` to its Babel parser for
  `**/*.{js,jsx,mjs,ts,tsx,mts,cts}`; its `next/typescript` object then sets typescript-eslint's parser for
  `**/*.ts` and `**/*.tsx` only. `parserOptions` merge across objects, so `.ts`/`.tsx` keep `projectService`, while
  `.js`/`.mjs`/`.mts`/`.cts` end up on the Babel parser with the type-checked rules still on.
- Reproduced in the scratch app with the README example: `eslint .` fails on `eslint.config.mjs` with
  "Error while loading rule '@typescript-eslint/await-thenable' ... Parser: eslint-config-next/parser".
- Also reproduced: with typescript-eslint 8.68.0 at the top and eslint-config-next's own nested 8.71.1 copy,
  `eslint .` fails with `Config "next/typescript": Key "plugins": Cannot redefine plugin "@typescript-eslint"`. The
  preset registers the plugin for every file, Next registers its own copy for TS files.
- The repository's tests lint with ESLint 10 through `new ESLint({ overrideConfigFile: true, overrideConfig })`;
  `espree` (ESLint's default parser) is installed at the root and stands in for Next's Babel parser in a test.
- `presets/tsconfig.json` sets `noUncheckedIndexedAccess: true`; `presets/lefthook.yml` names its language jobs
  (checked in the implementation for the exact job names used in the README line).
