# Implementation review: monorepo-tooling

Scope: full · Date: 2026-10-02 · Commits: 4b67598..4745181 · Gates: typecheck ✓ lint ✓ test ✓ (66 tests, 7 files, after fixes and after merging skills 0.3.0) · build ✓

## Verdict
Ready after fixes. All five phases landed in their own commits and do what the plan promised; the
hook behaviours were provoked in a scratchpad clone rather than assumed. The review found one gap
in what the gates enforce (commit messages), two robustness defects (a crash on a malformed link
escape, a test that broke the documented time-zone probe), one shape rule too rigid for FD-5, and
some dead or inaccurate config. All are fixed in 4745181 and re-checked; one packaging question is
deferred to FD-2. Re-reviewed under `@softure-ai/skills` 0.3.0 after the bump on `master`: same
findings, report rewritten in the 0.3.0 format.

## Dimensions
| Dimension | Verdict | Findings |
|---|---|---|
| Plan adherence | PASS | |
| Scope | PASS | unplanned files explained in plan.md Decisions; F1 adds a hook job (recorded there) |
| Progress honesty | PASS | |
| Correctness | WARNING | F2, F3 |
| Tests | WARNING | F4 |
| Data and migrations | PASS | none in this change |
| Security | PASS | |
| Architecture and patterns | WARNING | F1, F5 (suggestion), F6 (suggestion) |
| Lessons | PASS | `lessons.md` was empty |

## Plan coverage
| Phase | Commit | Delivered | Notes |
|---|---|---|---|
| 1 Toolchain and root gates | 03f56a1 | yes | environment test seen red under `NODE_ENV=production` before the pin |
| 2 Language gate | 366cb10 | yes | lockfile exempt and `+`/`=` adjacency (plan Decisions) |
| 3 Roadmap contract and link tests | 67c1cae | yes | sabotage of a real link and a real block status went red |
| 4 Package template and builds | 31a70df | yes | shape tests seen red by sabotage; build rule loosened by F4 |
| 5 Hooks, CI and agent docs | 5cfebb6 | yes | four provocations recorded in plan Decisions; `commit-msg` added by F1 |

Files: planned and changed 34 · unplanned 3 (`tests/repo/roadmap-contract.ts`,
`tests/repo/markdown-links.ts`: parsers split out of the tests, plan Decisions p3;
`templates/package/migrations/README.md`: instead of `.gitkeep`, plan Decisions p4) · planned, not
changed 0

## Findings

### F1 [WARNING] Commit messages were not checked by any gate
**Impact:** LOW (obvious, narrow fix) · **Dimension:** Architecture and patterns · **Where:** lefthook.yml
**What:** AGENTS.md makes commit messages English, but the language gate saw only staged files.
**Why it matters:** a Polish commit message lands in history unseen, and history cannot be fixed
without rewriting it.
**Evidence:** in the scratchpad clone, an empty commit with a Polish message went through before
the fix.
**Fix:** a `commit-msg` job running the gate on the message, ignoring git's `#` lines and the
`git commit -v` diff below the scissors line (that diff may touch `messages/`).
**Decision:** fix now: `--commit-msg` mode in `scripts/check-language.mjs` (`getCommitMessageText`,
two tests) and the job in `lefthook.yml`; provoked again in the clone: Polish message rejected,
English message and a scissors message with a Polish diff accepted (4745181)

### F2 [WARNING] A malformed percent escape crashed the link test
**Impact:** LOW (obvious, narrow fix) · **Dimension:** Correctness · **Where:** tests/repo/markdown-links.ts (`decodeURIComponent`)
**What:** a link such as `[x](100%.md)` threw `URIError`, failing the whole test with a stack
trace instead of naming the file and line.
**Why it matters:** the first stray `%` in any Markdown file turns the gate red with no pointer to
the cause.
**Evidence:** new test "reports a link with a malformed percent escape instead of crashing".
**Fix:** catch the error and report `link "…" is not a valid URL path`.
**Decision:** fix now (4745181)

### F3 [WARNING] The time-zone probe broke its own anchor test
**Impact:** LOW (obvious, narrow fix) · **Dimension:** Correctness · **Where:** tests/repo/test-environment.test.ts
**What:** `vitest.config.mts` documents `TEST_TZ=Europe/Warsaw npm test` as a probe, but the date
assertion only holds in New York, so every probe run went red.
**Why it matters:** the documented way to re-check date code in another zone was unusable.
**Evidence:** `TEST_TZ=Europe/Warsaw npx vitest run tests/repo/test-environment.test.ts` after the
fix: 2 passed, 1 skipped.
**Fix:** assert the resolved zone equals `TEST_TZ || "America/New_York"`; skip the negative-offset
date check while a probe runs.
**Decision:** fix now (4745181)

### F4 [WARNING] The build-script rule would block FD-5
**Impact:** LOW (obvious, narrow fix) · **Dimension:** Tests · **Where:** tests/repo/packages.test.ts
**What:** `scripts.build` had to equal `tsc -p tsconfig.build.json` exactly, but
`@softure-ai/ui` must append its CSS step.
**Why it matters:** FD-5 would have to weaken a test FD-1 owns to ship styles.
**Fix:** accept `tsc -p tsconfig.build.json` optionally followed by ` && <more>`.
**Decision:** fix now (4745181)

### F5 [SUGGESTION] Dead and inaccurate config
**Impact:** LOW (obvious, narrow fix) · **Dimension:** Architecture and patterns · **Where:** vitest.config.mts, scripts/build-workspaces.mjs
**What:** `ssr.resolve.externalConditions` had no effect (the template test resolves to `src/`
without it, checked with `dist/` deleted); the timeout comment claimed "ten times the slowest
test" (slowest is about 2.5 s, the limit 60 s); a variable named `workspaceDependencies` held all
dependencies.
**Fix:** remove the option, correct the comment, inline the variable.
**Decision:** fix now (under ten lines, no behaviour change) (4745181)

### F6 [SUGGESTION] Source and declaration maps point at unpublished `src/`
**Impact:** MEDIUM (a real trade-off) · **Dimension:** Architecture and patterns · **Where:** templates/package/tsconfig.build.json, templates/package/package.json (`files`)
**What:** the build emits `.js.map` and `.d.ts.map` that reference `../src/*.ts`, which `files`
does not publish.
**Why it matters:** consumers' "go to definition" lands in `.d.ts` instead of source; harmless
otherwise.
**Fix:** decide at pack time: publish `src/` too, or stop emitting maps.
**Decision:** defer -> `context/backlog/packaging.md` (FD-2 `release-pipeline` decides what a packed package contains)

## Progress audit
Every ticked item has evidence: test names in `tests/repo/*.test.ts` and
`templates/package/tests/messages.test.ts`; the red runs and sabotage runs quoted in plan.md
`## Decisions (auto)`; the clone provocations for 5.1-5.4; the YAML parse of `ci.yml` for 5.5. Gates
and `npm run build` re-run in this session after the fixes and after merging `origin/master`.
Break-it check on the riskiest behaviour (the language gate in `pre-commit`): a staged Polish
comment was rejected in the clone. Open Manual item, not a finding: 5.7 (first green `ci` run on
GitHub; the branch is pushed at READY).

## Triage summary
Fixed: F1, F2, F3, F4, F5 · Lessons: none from findings (one from the frame, below) · Deferred: F6
(`context/backlog/packaging.md`) · Accepted: none · Withdrawn: none. Fix commit 4745181; gates
green after it.

## Lessons proposed
- Build packages with `tsc`, never with a bundler, while they ship `"use client"` / `"use server"`
  files: bundlers merge modules and drop the directives silently (from research measurement 1 and
  frame.md) -> softure-lesson

## Decisions (auto)
- F1-F4 → fix now (WARNINGs with a clear local fix).
- F5 → fix now (SUGGESTION under ten lines, risk-free).
- F6 → defer to the backlog (the choice belongs to the release pipeline, FD-2).
- Report rewritten after the skills bump to 0.3.0 (coordinator's instruction): dimensions, impact,
  file accounting and a separate report commit, as the 0.3.0 skill requires.
