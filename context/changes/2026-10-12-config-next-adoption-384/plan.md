---
change_id: config-next-adoption-384
status: active
---

# Plan: config next adoption (issue #384)

Input: change.md, research.md. Complexity: small (one preset function, peers, docs).

## Phase 1: preset works next to Next's config (TDD)

Files: `tools/config/src/eslint/index.ts`, `tools/config/tests/eslint.test.ts`, `tools/config/package.json`.

1. Tests first, red on master:
   - An `.mjs` file lints with no type-information error, and with no `@typescript-eslint` type-checked rule.
   - With an `extends` config that sets espree as the parser for every file (Next's override), a `.ts` file still
     reports `@typescript-eslint/no-floating-promises`, and an `.mjs` file lints cleanly.
   - With an `extends` config that registers a different `@typescript-eslint` plugin object for TS files, linting a
     `.ts` file does not throw "Cannot redefine plugin".
2. Implement: `TYPESCRIPT_FILES = ["**/*.{ts,tsx,mts,cts}"]`; every `recommendedTypeChecked` object gets those files;
   a `softure/typescript-parser` object after `extends` sets `parser` and `projectService`/`tsconfigRootDir` for them;
   the `@typescript-eslint` plugin is taken from `extends` when one registers it.
3. Peers widened as in change.md.

## Phase 2: docs

`tools/config/README.md` (peers and ESLint 9, the Next example with a note on TS-only typed rules, the
`noUncheckedIndexedAccess` line, the lefthook skip snippet, one typescript-eslint copy), `tools/config/CHANGELOG.md`
(`## Unreleased`).

## Progress

- [x] Phase 1: preset works next to Next's config (`1622e3d`; four new tests failed on master, the package's 54
  tests green after)
- [x] Phase 2: docs (`241c790`)

Verified by hand in a scratch Next app (eslint 9.39.1, eslint-config-next 16.4.0, next 16, the packed preset): the
install resolves with no `ERESOLVE`; with the README example `eslint .` lints `eslint.config.mjs` and
`postcss.config.mjs` cleanly and reports `no-floating-promises` in a `.ts` file; with typescript-eslint 8.50.0 at the
top and Next's nested 8.71.1 the same run passes, where master fails with "Cannot redefine plugin". `lefthook dump`
with the README's skip snippet keeps `commit-msg` and marks both file jobs `skip: true`.

Gates on the branch: `npm run typecheck`, `npm run lint` green (pre-commit); config and repository tests pass, the
full `npm test` runs in pre-push.
