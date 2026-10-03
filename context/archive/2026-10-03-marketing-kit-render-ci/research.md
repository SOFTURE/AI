# Research: marketing-kit-render-ci

Input: change.md, roadmap FU-13. Depth: quick (one CI job around one existing test; no code, no data).
Snapshot: a7c5f35 on claude/project-thread-ekulai (from master), 2026-10-03.

## Summary
- The test exists and is opt-in: `tools/marketing-kit/tests/render.test.ts` runs only with `MARKETING_KIT_RENDER=1`
  (`render.test.ts:20,24`). It needs ffmpeg and ffprobe in `PATH`, a Chromium for Playwright and a Chrome for
  hyperframes (`render.test.ts:15-17`); it prepares the fixture with generated tones, so no paid TTS
  (`examples/fixture/prepare.ts:9-15`).
- CI today: the `test` job sets `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome` (the runner image's Chrome) for the
  screenshot tests and runs `npm test`; the render test is skipped there (`.github/workflows/ci.yml`, job `test`).
- The roadmap Unknown ("does the e2e job's Playwright Chromium also serve hyperframes") is answered by reading
  hyperframes 0.8.85's browser resolution: `HYPERFRAMES_BROWSER_PATH` wins, then its own cache
  (`~/.cache/hyperframes/chrome`, the pinned chrome-headless-shell), then any system Chrome
  (`/usr/bin/google-chrome` on a runner), which it accepts with a warning and a slower screenshot capture path because
  regular Chrome has no `HeadlessExperimental.beginFrame` (`node_modules/hyperframes/dist/renderSetupWorker.js`,
  `findBrowser`, `findSystemBrowser`, `warnSystemFallbackOnce`). So any Chrome "serves", but only the headless shell
  takes the path real renders take.
- `npx hyperframes browser ensure --force` downloads the pinned chrome-headless-shell into its cache even when a system
  Chrome exists (`--force` skips the lookup), and `npx hyperframes browser path` prints the binary hyperframes will
  use (`node_modules/hyperframes/dist/cli.js`, `runEnsure`, `runPath`). Without `--force`, `ensure` stops at the
  system Chrome on a runner.
- Run time locally: 97 s for the test (measured below); the roadmap estimate was about 85 s.

## Current state
| Piece | Where | Note |
| --- | --- | --- |
| Render test | `tools/marketing-kit/tests/render.test.ts` | `describe.runIf(MARKETING_KIT_RENDER === "1")`, 600 s timeout; runs `tsx src/cli/main.ts all fixture-tour --quality=draft`, probes the MP4 with ffprobe, then records the JSON twin and compares logs |
| Recorder browser | `src/record/record.ts:109` | `chromium.launch({ executablePath })`, path from `PLAYWRIGHT_CHROMIUM_PATH` |
| Render browser | `src/render/hyperframes.ts:22-25` | passes `HYPERFRAMES_BROWSER_PATH` through, sets `HYPERFRAMES_NO_TELEMETRY=1` |
| Preflight | `src/render/preflight.ts:19-24` | fails without ffmpeg in `PATH` |
| CI | `.github/workflows/ci.yml` | jobs `static`, `test`, `build`; Node 22, `npm ci` |
| e2e CI | `.github/workflows/e2e.yml` | installs Playwright's Chromium with `--with-deps` in `examples/next-app` (another lockfile, another Playwright) |

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | a new job that installs ffmpeg and hyperframes' Chrome and runs the render test |

## Options
| Option | For | Against |
| --- | --- | --- |
| A step in the `test` job | one `npm ci` | the slowest test hides in the suite's time; a render failure reads as "unit tests" |
| **A `render` job in ci.yml** | named check, runs in parallel with `test` | one more `npm ci` (cached) |
| hyperframes on the runner's Chrome | no download | screenshot capture path, not the one real renders take |
| **hyperframes on its pinned headless shell (`browser ensure --force`)** | the version hyperframes ships for, the path real renders take | a ~100 MB download per run |
| Playwright's `chromium-headless-shell` for hyperframes | proven locally | another version than hyperframes pins, a path to find in Playwright's cache |

## Measurements
- Local run (this container, `PLAYWRIGHT_CHROMIUM_PATH` = Playwright's Chromium 1194, `HYPERFRAMES_BROWSER_PATH` =
  Playwright's headless shell 1194): 1 passed, 96.8 s test duration, 1 min 38 s wall clock.
- The hyperframes download cannot be probed here: the sandbox proxy answers 403 for `storage.googleapis.com`. GitHub's
  runners reach it; the first CI run is the probe.
- First CI probe (run 37160186638): `ensure --force` downloaded and printed "Ready to render." within 4 s, then never
  exited (cancelled after 6 min). Without a download (`HYPERFRAMES_BROWSER_PATH` set, or the cache present) the same
  command exits in about 1 s locally.
- CI with the workaround (run 37161219144): download and stop in a few seconds, render test 82 s, job about 2 min 10 s.

## Risks
- ffmpeg on the runner: ubuntu-latest may not ship it; install it with apt when `command -v ffmpeg` fails.
- A flaky download fails the job: rare; a re-run is the remedy, and the error names the download.
- Run time grows with the fixture: the job has its own timeout.

## Open questions
| Question | State | Answer |
| --- | --- | --- |
| Which Chrome for hyperframes | decided (auto) | its pinned headless shell via `browser ensure --force`, path from `browser path` into `HYPERFRAMES_BROWSER_PATH` |
| Which Chromium for the recorder | decided (auto) | the runner's Chrome, as the `test` job already does (`PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome`) |
| Job or step | decided (auto) | a separate `render` job |
| Cache the headless shell | decided (auto) | no: one download per run is cheap on GitHub, a cache adds a key to keep in step with the hyperframes version |
