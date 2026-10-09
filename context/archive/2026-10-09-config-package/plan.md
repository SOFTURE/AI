# Plan: config-package

Input: change.md (research folded into Findings, framing skipped). Complexity: medium (one new package, two phases).

## Goal

A new workspace package `tools/config` (`@softure-ai/config` 0.1.0) with four parts: the language gate (functions +
`softure-check-language` bin), an ESLint flat config factory, a tsconfig preset and a lefthook preset. The repository's
own gate (`scripts/check-language.mjs`) is replaced by the package's source.

**Out of scope:** the `server-only` shim (Decisions), moving the example app onto the presets (it installs packed
packages; a test pins its tsconfig to the preset instead), a release.

## Findings

- `scripts/check-language.mjs` holds the gate: diacritic regex, a Polish word list, `isExempt` (`messages/`, `pl/`
  folders plus three repo files), `findPolishText`, `checkFiles`, `getCommitMessageText`, a CLI with `--all` and
  `--commit-msg`. `lefthook.yml`, `package.json` (`lint:language`) and `tests/repo/language.test.ts` call it.
- `tsx` 4.23 is already installed (a dependency of marketing-kit); Node 22 cannot run the package's TS source without it.
- `tests/repo/packages.test.ts`: every code export is `@softure-ai/source` → `src/*.ts`, types, default; string exports
  (JSON, YAML) are allowed, as marketing-kit's schema shows. The release rules require `src`, `dist`, `CHANGELOG.md` in
  `files` and no tests.
- `tsconfig.base.json` and `examples/next-app/tsconfig.json` target ES2023; the example app's options are the Next
  app shape.

## Key decisions

- **D1 placement.** `tools/config`, bin `softure-check-language` → `dist/cli/check-language.js`, exports
  `./eslint`, `./language`, `./tsconfig.json` (`presets/tsconfig.json`), `./lefthook.yml` (`presets/lefthook.yml`).
- **D2 one gate.** The gate moves to `src/language/`; its words and diacritics sit in `src/language/pl/polish.ts`
  and its Polish tests in `tests/pl/`, so the folder rule exempts them and the repo-specific exempt list goes away.
  Lockfiles of npm, pnpm and yarn stay exempt by file name. The repository calls it through `tsx` (root devDependency).
- **D3 ESLint factory.** `createSoftureEslintConfig({ tsconfigRootDir, extends?, ignores?, integration?, fixtures? })`
  returns a flat config. The two test rules are one `no-restricted-imports` entry per file set, because the last
  matching config object sets a rule's options: integration files get the black box patterns and, with fixtures on,
  the `@playwright/test` `test` path too. `fixtures.exempt` turns the rule off for the fixtures module.
- **D4 presets.** The tsconfig preset holds compiler options only (`include` resolves relative to the declaring file).
  The lefthook preset mirrors this repository's pre-commit and commit-msg hooks with the bin, and runs typecheck,
  lint, language and tests on pre-push, piped. The `prepare` CI gate is a README snippet (it lives in the app's
  package.json).

## Phase 1: language gate (TDD)

**Files:** `tools/config/src/language/**`, `src/cli/**`, `tests/pl/language.test.ts` (moved from `tests/repo/`),
`tests/check-language-command.test.ts`, `tests/repo/language.test.ts`, root `package.json`, `lefthook.yml`.

Done when: the moved tests pass against the package, the CLI tests cover files, `--all`, `--commit-msg`, a missing
file and bad arguments, `npm run lint:language` passes, `scripts/check-language.mjs` is gone.

## Phase 2: ESLint, presets, docs

**Files:** `src/eslint/index.ts`, `presets/*`, `tests/eslint.test.ts`, `tests/presets.test.ts`, README, CHANGELOG,
root README.

Done when: ESLint tests show both rules firing and not firing; the tsconfig preset resolves through the package export
and matches the base target and the example app; the lefthook preset has the expected jobs; gates green.

## Risks and rollback

- `tsx` in the hooks adds a few hundred milliseconds to a commit. Rollback: revert the commit; the old script returns.
- A first publish of a new npm name goes through `NPM_TOKEN`; binding the trusted publisher afterwards is an owner step.

## Progress

- [x] Phase 1: language gate
- [x] Phase 2: ESLint, presets, docs
- [x] Gates: typecheck, lint, test, build

## Before the next release

- First publish of `@softure-ai/config` uses `NPM_TOKEN` (release.yml); afterwards bind the npm trusted publisher to
  `release.yml` for the new package name (scripts/release/README.md).
