# Plan: marketing-kit-render-ci

Input: change.md, research.md. Complexity: small.

## Goal
Every push and pull request runs `tools/marketing-kit/tests/render.test.ts` with `MARKETING_KIT_RENDER=1` in a
`render` job of `.github/workflows/ci.yml`: the fixture film is recorded with the runner's Chrome, rendered by
hyperframes on its pinned chrome-headless-shell, and checked as a 1080×1920 MP4 with audio. A broken recorder,
composition or render fails that job by name.

**Out of scope:** caching the headless shell; rendering the 1:1 and 16:9 formats (the test renders the film's
configured format); changes to the test itself or to the marketing kit; the e2e workflow.

## Approach
**Starting point:** the test is opt-in and passes locally; CI's `test` job already gives Playwright the runner's
Chrome (research §Current state).

**Chosen:** a separate `render` job: checkout, Node 22 with the npm cache, `npm ci`, ffmpeg when missing, hyperframes'
headless shell through its own CLI, then `npx vitest run tools/marketing-kit/tests/render.test.ts --reporter=verbose` (the log names the test and its ✓).
Rejected: a step in `test` (the render hides in the suite and its failure reads as a unit test); the runner's Chrome
for hyperframes (screenshot capture fallback, not the path real renders take); Playwright's headless shell (a
version hyperframes does not pin, a path to dig out of Playwright's cache).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where | job `render` in `ci.yml` | named check, parallel with `test` | research §Options |
| Recorder Chromium | `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome` | same as the `test` job, proven | ci.yml |
| hyperframes Chrome | `npx hyperframes browser ensure --force`, then `HYPERFRAMES_BROWSER_PATH=$(npx hyperframes browser path)` into `$GITHUB_ENV` | pinned headless shell, explicit path the roadmap asks for | research §Summary |
| ffmpeg | `command -v ffmpeg` or `sudo apt-get install -y --no-install-recommends ffmpeg` | the image may not ship it; no install when it does | research §Risks |
| Telemetry | `HYPERFRAMES_NO_TELEMETRY=1` at job level | the CLI sets it for renders; `browser ensure` runs outside the CLI | `src/render/hyperframes.ts:22-25` |
| Time limit | `timeout-minutes: 15` | the test allows 10 min; a hung download must not hold a runner for 6 h | plan |
| Output on failure | none uploaded | the test's assertion message carries the CLI's stdout and stderr | `render.test.ts:35` |

**Critical details:** `browser path` without `HYPERFRAMES_BROWSER_PATH` set resolves env → hyperframes cache → system
Chrome, so it must run after `ensure --force`, and the step fails if the printed path is not inside
`~/.cache/hyperframes` (a guard against silently rendering on the system Chrome). `npx vitest run <file>` uses the
root `vitest.config.mts`, so `NODE_ENV=test` and the TZ pin hold.

## Phase 1: The render job
**Discipline:** test-after (CI config; the test exists, the job is its harness). **Files:** `.github/workflows/ci.yml`,
`tools/marketing-kit/README.md` (Development section, around line 371-382)

1. Add job `render` ("marketing-kit fixture film render") after `test`, with the decisions above.
2. README Development section: one sentence that CI runs the render test in the `render` job on every push.
3. Push; the first CI run is the probe for the download and the run time. Record the run time in research.md.

**Tests:** the render test itself, now in CI; locally the same command with local browser paths.

**Done when:**
- Automated: the `render` job is green on the PR's head commit and its log shows the render test ran (1 passed, not skipped).
- Automated: the job's `HYPERFRAMES_BROWSER_PATH` points into `~/.cache/hyperframes` (the guard step passes).
- Automated: Gates green (typecheck, lint, test).

## Risks and rollback
- Download failure or a slow runner → the job fails by name; re-run once, and a second failure is investigated.
- Rollback: revert the commit; the test returns to opt-in only.

## Decisions (auto)
- Complexity → small (one workflow file).
- No cache for the headless shell (research §Open questions).
- Implementation drift (CI probe): on the first run `hyperframes browser ensure --force` downloaded the headless shell
  in 4 s and printed "Ready to render." but never exited, so the step hung until cancelled. The step now runs it as a
  background job in its own process group (`set -m`), waits for that line (or fails with the log if the process ends
  without it) and stops the group; the `browser path` guard still proves the cache holds the binary. Step timeout 5 min.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The render job

#### Automated
- [ ] 1.1 The `render` job is green on the PR head and its log shows the render test passed, not skipped
- [ ] 1.2 `HYPERFRAMES_BROWSER_PATH` points into `~/.cache/hyperframes` (guard step passes)
- [ ] 1.3 Gates green (typecheck, lint, test)
