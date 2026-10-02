# Implementation review: monorepo-tooling

Date: 2026-10-02 · Commits: 4b67598..5cfebb6 (+ review fix) · Gates: typecheck ✓ lint ✓ test ✓ (66 tests, 7 files)

## Verdict

Ready after fixes. Every phase landed in its own commit and does what the plan promised; the hook
behaviours were provoked in a scratchpad clone, not assumed. The review found one gap in what the
gates enforce (commit messages), two robustness defects (a crash on a malformed link, a test that
breaks the documented time-zone probe), one rule too rigid for FD-5, and some inaccurate or dead
config. All fixed in one commit.

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1. Toolchain and root gates | 03f56a1 | TS 6.0, ESLint 10 typed, Vitest 5/Vite 8, ESM root, NODE_ENV/TZ pins, gates in workflow.json | environment test seen red under `NODE_ENV=production` |
| 2. Language gate | 366cb10 | `scripts/check-language.mjs`, `lint` = ESLint + language, test (a) | lockfile exempt and `+`/`=` adjacency (Decisions) |
| 3. Roadmap contract and link tests | 67c1cae | tests (b) and (c) plus parsers in `tests/repo/` | sabotage of a real link and a real block status went red |
| 4. Package template and builds | 31a70df | `templates/package/` as a private workspace, topological `npm run build`, shape tests, `next/*` boundary rule, docs/02 §12 | shape tests seen red by sabotage |
| 5. Hooks, CI and agent docs | 5cfebb6 | lefthook pre-commit/pre-push, `prepare`, `ci.yml`, AGENTS.md section | four provocations recorded in plan Decisions |

No commit outside a phase except the roadmap stage commits written by `wt-roadmap.py`.

## Findings

### F1 [WARNING] Commit messages were not checked by any gate
**Where:** `lefthook.yml` · **What:** AGENTS.md says commit messages are English, the
change's language gate only saw staged files. · **Why it matters:** a Polish commit message
lands in history unseen, and history cannot be fixed without rewriting it. · **Evidence:** in the
scratchpad clone, `git commit --allow-empty -m "<Polish message>"` succeeded before the fix.
**Decision:** fix now: `commit-msg` job running `check-language.mjs --commit-msg {1}`; the mode
drops git's `#` lines and everything below the `git commit -v` scissors line (that diff may
legitimately touch `messages/`). Tests for both; provoked again in the clone: Polish message
rejected, English message and a scissors message with Polish diff accepted.

### F2 [WARNING] A malformed percent escape crashed the link test
**Where:** `tests/repo/markdown-links.ts` (`decodeURIComponent`) · **What:** a link such as
`[x](100%.md)` threw `URIError` and failed the whole test with a stack trace instead of naming the
file and line. · **Decision:** fix now: reported as `link "…" is not a valid URL path`, with a test.

### F3 [WARNING] The time-zone probe broke its own anchor test
**Where:** `tests/repo/test-environment.test.ts` · **What:** `vitest.config.mts` documents
`TEST_TZ=Europe/Warsaw npm test` as a probe, but the date assertion only holds in New York, so the
probe always went red. · **Decision:** fix now: one test asserts the resolved zone equals
`TEST_TZ || "America/New_York"`; the negative-offset date check is skipped while a probe runs.
Verified: `TEST_TZ=Europe/Warsaw` → 2 passed, 1 skipped.

### F4 [WARNING] The build-script rule would block FD-5
**Where:** `tests/repo/packages.test.ts` · **What:** `scripts.build` had to equal
`tsc -p tsconfig.build.json` exactly, but `@softure-ai/ui` must append a CSS step.
**Decision:** fix now: the rule accepts `tsc -p tsconfig.build.json` optionally followed by
` && <more>`.

### F5 [SUGGESTION] Dead and inaccurate config
**Where:** `vitest.config.mts`, `scripts/build-workspaces.mjs` · **What:**
`ssr.resolve.externalConditions` had no effect (the template test resolves to `src/` without it,
checked after removing it with `dist/` deleted); the timeout comment claimed "ten times the slowest
test" (slowest is 2.4-2.6 s, limit 60 s); a variable named `workspaceDependencies` held all
dependencies. · **Decision:** fix now (under ten lines, no behaviour change).

### F6 [SUGGESTION] Source and declaration maps point at unpublished `src/`
**Where:** `templates/package/tsconfig.build.json`, `files` · **Decision:** defer to FD-2
(`release-pipeline`), which decides what a packed package contains; recorded in plan Decisions.

## Checks with no findings

- Error paths: the CLIs exit 1 with `path:line: reason` lines; `findWorkspaces` names the workspace
  on a missing `name`; `build-workspaces` stops on the first failing build with its output visible.
- Security: `ci.yml` has `permissions: contents: read`, no secrets, no `pull_request_target`.
- Migrations: none.
- Lessons: `lessons.md` was empty; one lesson proposed below.

## Progress audit

Every `- [x]` item has evidence: test names in `tests/repo/*.test.ts`, the red runs and sabotage
runs quoted in plan.md Decisions, the clone provocations (5.1-5.4), and the YAML parse of `ci.yml`
(5.5). Item 5.7 (first green CI run on GitHub) stays open: the branch is not pushed yet and this
session has no GitHub Actions access.

## Lessons proposed

- Build packages with `tsc`, never with a bundler, while they ship `"use client"` / `"use server"`
  files: bundlers merge modules and drop the directives silently → softure-lesson (L-001).
