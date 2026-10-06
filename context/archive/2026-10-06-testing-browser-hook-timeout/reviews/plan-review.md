# Plan review: testing-browser-hook-timeout

Reviewed `plan.md` against `change.md`, `research.md`, the code and the repository rules (2026-10-06).

| # | Finding | Severity | Evidence | Decision |
| --- | --- | --- | --- | --- |
| F1 | The plan had no test that fails without the fix ("A bug fix starts with a test that fails without it", AGENTS.md). The scratch 11 s hook proves the mechanism once but guards nothing afterwards, and a permanent 11 s hook would cost every run. | Warning | AGENTS.md → Tests | Accepted: phase 1 adds a repository test that `hookTimeout` equals `testTimeout` in the exported config; it is red before the config line. |
| F2 | Does Vitest 5 still accept `test.hookTimeout`? | Check | `node_modules/vitest/dist/chunks/plugin.d.*.d.ts:3708` declares `hookTimeout?: number` | No change. |
| F3 | The temporary `console.info` could trip a lint rule. | Check | `eslint.config.*` has no `no-console` rule | No change; phase 2 removes the line anyway. |
| F4 | The language gate covers the new comment and Markdown. | Check | All text written in English | No change. |
| F5 | No published code changes, so no version bump; LT-2's broken bump path is not touched. | Check | Only `vitest.config.mts`, a test file and `tests/repo/` change; tests are not in any package's `files` | No change. |
| F6 | LT-2 runs in parallel and edits the same rows in `roadmap-later.md` and the backlog README. | Suggestion | Coordinator brief | Merge `origin/master` before the PR merge; master wins on its rows. |

Verdict: ready to implement with F1 applied.
