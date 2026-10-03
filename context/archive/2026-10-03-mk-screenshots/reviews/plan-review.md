# Plan review: mk-screenshots

Reviewed: [`plan.md`](../plan.md) against [`change.md`](../change.md), [`research.md`](../research.md),
[`frame.md`](../frame.md) and the code on master (e15e5c5). Reviewer: the implementing session, before
any code (owner's full-autonomy rule).

Verdict: **approved with changes**. No blocker; three warnings folded into the plan below.

## Riskiest claims

1. "Chrome on the runner drives the browser tests": Playwright 1.63 with `executablePath` pointing at
   Chrome stable. Not verifiable from this session; the plan makes a wrong path fail loudly instead of
   skipping, so CI shows it on the first push.
2. "No schema change": checked field by field against the roadmap outcome (`schema.ts:239-251`). Holds.
3. "`ensureServer` needs only `url` and `ownUrl`": `server.ts:20-60` reads nothing else from the video. Holds.

## Lenses

| Lens | Result |
| --- | --- |
| Outcome coverage | every roadmap bullet maps to a decision row and a test |
| Ownership | new code only in `src/screenshot/`; `src/cli/` touched minimally; MK-3/6/7 folders untouched |
| Conventions | result union, no optional bag for the options (union), messages name the input |
| Architecture test | see W1 |
| Tests in CI | see W2 |
| Rollback | revert; no persistent state |

## Findings

### W1 [WARNING] `deviceScaleFactor: 1` trips the architecture test

`tests/architecture.test.ts` forbids `/deviceScaleFactor:\s*\d/` in `src/` (a fixed device scale).
**Fix:** leave `deviceScaleFactor` out of the context options; Playwright's default is 1. Plan updated:
the browser row reads "Playwright's default scale (1)".

### W2 [WARNING] A missing Chromium must not silently skip the browser tests in CI

If the CI env line were wrong and the tests skipped, the gates would look covered and not be.
**Fix (already in the plan):** skip only when no Chromium is configured **and** Playwright's own is not
installed; a configured `PLAYWRIGHT_CHROMIUM_PATH` that does not exist fails the suite. If Chrome stable
cannot be driven on the runner, fall back to `npx playwright install --with-deps chromium` in the `test`
job, as `e2e.yml` does.

### W3 [WARNING] The fixture page may be smaller than the 40 kB default

A plain dark page at 1280×800 compresses to a few kB, so the CLI test would fail on the size gate for a
reason that says nothing about the command.
**Fix:** the fixture entry sets `minBytes` explicitly (a few kB) with the reason in the README; the 40 kB
default is tested in the screenshot test with a page known to exceed it, and below it with one known not to.

### S1 [SUGGESTION] Fixture ports shared with the opt-in render test

The CLI test starts the fixture app on port 3198, as the opt-in render test does. If both ran at once
the second would reuse the first's server, which serves the same files. Acceptable; noted in the test.

## Triage summary

| Finding | Decision |
| --- | --- |
| W1 | fixed in plan |
| W2 | already in plan; fallback named |
| W3 | fixed in plan |
| S1 | accepted, documented |
