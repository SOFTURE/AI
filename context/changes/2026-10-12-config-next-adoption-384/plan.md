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

- [ ] Phase 1: preset works next to Next's config
- [ ] Phase 2: docs
