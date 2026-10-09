---
change_id: config-package
title: "config: a new package @softure-ai/config with the ESLint preset, tsconfig base, lefthook hooks and the language gate bin (issue #327)"
status: archived
roadmap_item: null
issue: 327
branch: claude/project-thread-nno88t
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

An app installs `@softure-ai/config` and takes its ESLint flat config, its tsconfig base, its git hooks and the
language gate from one package instead of copying them: `createSoftureEslintConfig()` from
`@softure-ai/config/eslint`, `"extends": "@softure-ai/config/tsconfig.json"`, `extends:` the package's
`presets/lefthook.yml`, and `npx softure-check-language`. This repository runs the same gate from the package's
source, so there is one implementation of it.

A reviewer checks `tools/config/` (sources, presets, tests, README, CHANGELOG), the root `package.json`,
`lefthook.yml` and `tests/repo/language.test.ts`.

## Context

Issue [#327](https://github.com/SOFTURE/AI/issues/327): the copies drift (an adopting app targets ES2017, the example
app ES2023); the monorepo runs `scripts/check-language.mjs` but apps do not, although the language rule installed by
`@softure-ai/skills` is mandatory. Scope: an ESLint flat config (Next + TS, `--max-warnings 0`, the integration black
box rule, the "import `test` from fixtures" rule), a tsconfig base with the target the packages test, a lefthook
config with the `prepare` CI gate, the `softure-check-language` bin, and optionally a `server-only` register shim.

## Constraints

- A workspace package under `tools/` (it is tooling, like `deploy` and `marketing-kit`), passing the shape and
  release rules of `tests/repo/packages.test.ts`; version 0.1.0, CHANGELOG `## 0.1.0`.
- No new dependency for the language gate; the ESLint packages are optional peers.
- #326 (testing) may ship a Playwright `test` with its own client address; the fixtures rule names the module as an
  option, so it does not depend on #326.
- English only; the gate's word list and its Polish test data live in `pl/` folders.

## Notes

- Research: folded into `plan.md` § Findings; the issue names the files and the repository holds every source.
- Framing: skipped; the issue states the problem and the scope.
- Placement: unlinked (`roadmap_item: null`, `issue: 327`), one GitHub issue per change.
- Archived 2026-10-09: the package exists, the repository's language gate runs from it.

## Decisions (auto)

- **Next.js rules through `extends`.** The preset does not depend on `eslint-config-next`: an app passes Next's flat
  config in `extends`. The issue's "Next + TS" holds, without pinning a Next version in a tooling package.
- **The optional `server-only` shim is left out.** It is marked optional in the issue and is a runtime concern, not
  lint or type config; a follow-up issue can add it when an app asks again.
- **The monorepo keeps its own ESLint config and hooks** (they carry the package boundary rules and a different
  pre-push); only the language gate moves, since it is the same code.
