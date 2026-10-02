---
change_id: monorepo-tooling
title: "Monorepo tooling and gates"
status: archived
roadmap_item: FD-1
branch: claude/project-thread-8qjd9k (cloud session, no worktree)
created: 2026-10-02
updated: 2026-10-02
archived_at: 2026-10-02
---

## Intent

`npm ci && npm run typecheck && npm run lint && npm test` works at the root over
all workspaces; each package builds ESM + `.d.ts` (tsup) and, where it has styles, compiled CSS;
a package template (`templates/package/`) matches docs/02 §2; `context/workflow.json` gates
point at the real scripts. **Git hooks via lefthook, mirroring FIRE_TRACKER's gates**
(`FIRE_TRACKER/lefthook.yml` and the pre-push gates section of its AGENTS.md are the reference):
- `pre-commit` (seconds, parallel): `tsc --noEmit` over the whole tree; `eslint
{staged_files} --max-warnings 0 --no-warn-ignored`; a **language gate** that fails on
Polish text (diacritics and common words) in staged files outside `messages/` dictionaries
(the mandatory English-only rule in AGENTS.md). Code jobs are skipped by `glob` when only
markdown changed; the language gate runs on markdown too.
- `pre-push`: the full `npm test`.
- `prepare` installs hooks only outside CI (`CI` set → skip), as FIRE does.
- CI (`.github/workflows/ci.yml`) runs the same `static` job (typecheck, lint, language) and
the unit tests on every push and PR. The suite is fast here, unlike FIRE's on-demand tests.
- **Repository tests from day one**, so the test gate guards something before any package
exists: (a) the language rule over all tracked files; (b) the roadmap contract: every row
in `roadmap.md` and `roadmaps/roadmap-*.md` parses with the WORKFLOW §5 regexes, the row
status equals the item block status, each change-id is unique and lives in exactly one of
`changes/`, `backlog/`, `archive/`; (c) relative links in `context/` and `docs/` resolve.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-1** (roadmap `foundation`):

> ### FD-1: Monorepo tooling and gates
> - **Change ID:** `monorepo-tooling`
> - **Status:** ready
> - **Outcome:** `npm ci && npm run typecheck && npm run lint && npm test` works at the root over
>   all workspaces; each package builds ESM + `.d.ts` (tsup) and, where it has styles, compiled CSS;
>   a package template (`templates/package/`) matches docs/02 §2; `context/workflow.json` gates
>   point at the real scripts. **Git hooks via lefthook, mirroring FIRE_TRACKER's gates**
>   (`FIRE_TRACKER/lefthook.yml` and the pre-push gates section of its AGENTS.md are the reference):
>   - `pre-commit` (seconds, parallel): `tsc --noEmit` over the whole tree; `eslint
>     {staged_files} --max-warnings 0 --no-warn-ignored`; a **language gate** that fails on
>     Polish text (diacritics and common words) in staged files outside `messages/` dictionaries
>     (the mandatory English-only rule in AGENTS.md). Code jobs are skipped by `glob` when only
>     markdown changed; the language gate runs on markdown too.
>   - `pre-push`: the full `npm test`.
>   - `prepare` installs hooks only outside CI (`CI` set → skip), as FIRE does.
>   - CI (`.github/workflows/ci.yml`) runs the same `static` job (typecheck, lint, language) and
>     the unit tests on every push and PR. The suite is fast here, unlike FIRE's on-demand tests.
>   - **Repository tests from day one**, so the test gate guards something before any package
>     exists: (a) the language rule over all tracked files; (b) the roadmap contract: every row
>     in `roadmap.md` and `roadmaps/roadmap-*.md` parses with the WORKFLOW §5 regexes, the row
>     status equals the item block status, each change-id is unique and lives in exactly one of
>     `changes/`, `backlog/`, `archive/`; (c) relative links in `context/` and `docs/` resolve.
> - **Prerequisites:** none.
> - **Unknowns:** tsup vs. tsc-only builds for server-only code; how to run architecture tests
>   (docs/02 §5) once for all packages; how NODE_ENV=production on the owner's machine affects
>   `npm ci` (FIRE needs `--include=dev`); current majors (TypeScript 7, ESLint 10, Vitest 5)
>   vs. FIRE's (TS 5, ESLint 9, Vitest 4): pick deliberately and record why; lefthook `glob`
>   behaviour for the markdown-only skip.
> - **Risk:** low. Wrong choices are cheap to change before any package ships.
> - **Baseline:** no build, no hooks. After: all four commands green; a commit with a Polish
>   comment or a lint warning is rejected by `pre-commit`; a push with a failing test is rejected
>   by `pre-push`; a commit touching only `*.md` skips typecheck and lint.
> - **PRD refs:** FR-1, NFR-1, NFR-3, NFR-6.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `lefthook.yml`, `scripts/check-language.*`, `tests/repo/`, `package.json`, `tsconfig*.json`, `eslint.config.*`, `vitest.config.*`, `.github/workflows/ci.yml`, `templates/package/`, `context/workflow.json` (gates).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

Execution notes (readiness review, 2026-10-02):
- Gates in `context/workflow.json` are `null` until this change. From phase 1 on, use the root
  `npm run typecheck|lint|test` this change creates, and set the gates in this branch's `workflow.json`.
- Language gate and test (a): allowlist backticked FIRE_TRACKER source paths and route slugs quoted in
  docs, roadmaps and backlog (e.g. `src/app/nie-pamietam-hasla/`). They are references to real paths,
  not prose. Do not edit files outside this change to make the gate pass.
- Roadmap test (b): `wt-roadmap.py` writes `**in_progress** (...)` in the row and plain `in_progress (...)`
  in the item block. Compare statuses with `**` stripped, and accept the whole WORKFLOW §5 vocabulary,
  or every gate goes red while items are in flight.
- The owner's shell has `NODE_ENV=production`. `.npmrc` (`include=dev`) covers installs. The test
  script or `vitest.config` must force `NODE_ENV=test`, or React tests fail later (FD-5, FD-6).
- `prepare` (`lefthook install`) writes into the shared `.git/hooks`. The roadmap header tells the
  manager to run `npm ci` in the main tree after merging this change.
- Reference sources: `../../FIRE_TRACKER/lefthook.yml`, `../../FIRE_TRACKER/eslint.config.mjs`,
  `../../FIRE_TRACKER/vitest.config.mts`, and the pre-push gates section of `../../FIRE_TRACKER/AGENTS.md`.
- Framing (2026-10-02): builds use `tsc`, not tsup; see `frame.md`.

Archived 2026-10-02: root typecheck, lint (with the language gate), test and build gates run in lefthook hooks and in CI; packages build with tsc from `templates/package/`.
