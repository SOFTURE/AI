# Research: testing-browser-hook-timeout

## Findings

1. **One failure, three times on 2026-10-06.** The release run 37444519206 (attempt 1) and `ci` runs 37512131054 and
   37515421605 (PR #141, a documents-only change) each failed `npm test` with exactly one failed suite:
   `foundation/testing/tests/playwright-browser.test.ts`, `Error: Hook timed out in 10000ms` at the `beforeAll` on
   line 91. The file ended at 10006 ms and 10008 ms with all 10 tests reported skipped; 4020 other tests passed.
   No test timed out anywhere.
2. **The hook does two things:** `server.listen(0)` and `chromium.launch({ executablePath })` (CI:
   `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome`).
3. **Which part is slow.** Measured in the cloud container (4 CPU, Chromium 1194 at `/opt/pw-browsers/chromium`),
   five and twenty rounds of the hook body:
   - idle: server 0–8 ms, launch 104–130 ms;
   - while the full `npm test` ran beside it (load average ~4 on 4 cores): server 0–5 ms, launch 138–237 ms.

   The server is never the slow part; the browser launch is. On a warm machine it stays far below 10 s, so the CI
   failures come from the runner, not the code: in both `ci` runs the file starts 1–1.5 min into the suite while
   `tools/marketing-kit/tests/screenshot.test.ts` (42.6 s and 48.1 s) launches Chrome itself, on a 4-core runner
   that `maxWorkers: "50%"` fills with two workers plus Postgres.
4. **Why only this file.** `vitest.config.mts` raises `testTimeout` to 60 s but leaves `hookTimeout` at Vitest's
   default of 10 s. The marketing-kit browser tests launch Chrome inside their tests (60 s); this file launches it in
   `beforeAll` (10 s). It is the only test file in the repository that launches a browser in a hook.
5. **The same file lowers three test limits.** Three tests pass `15_000` as their timeout. They were written
   (DP-7, 2026-10-05 18:39 UTC) after `testTimeout: 60_000` landed (BF-3, 2026-10-05 07:53 UTC), so the argument
   lowers their limit from 60 s to 15 s. Each of them waits out a failing Playwright `expect` (5 s by default) on
   purpose, so they are the slowest tests in the file by design and the closest to their limit on a loaded runner.
6. **Other hooks.** `beforeAll` appears in 10 test files; the rest create PGlite databases, servers or fixtures. None
   has failed on the 10 s limit so far, but they run on the same loaded runner.

## Answer to the unknown

"Whether the hook or the browser launch is the slow part": the browser launch (finding 3).

## Options

- **A. Global `hookTimeout: 60_000`** in `vitest.config.mts`, next to `testTimeout` and with the same reasoning: a
  limit that measures nothing about speed should not fail a loaded runner. Covers every hook, present and future.
- **B. A timeout on this one `beforeAll`.** Fixes the file, leaves the 10 s default for every other hook.
- **C. Launch Chromium lazily inside the first test.** Moves the cost under `testTimeout`, but makes one test pay for
  the setup of all and changes the test's shape for a configuration gap.

Recommendation: **A**, plus dropping the three `15_000` arguments so those tests inherit the global 60 s
(finding 5). FIRE_TRACKER's rule for the same class (L-052 there): raise the limit globally, with the measurement in
a comment, not per test.
