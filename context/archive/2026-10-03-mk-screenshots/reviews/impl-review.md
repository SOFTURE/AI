# Implementation review: mk-screenshots

Reviewed: the branch `claude/project-thread-p5jnbq` against [`plan.md`](../plan.md) and
[`plan-review.md`](plan-review.md). Reviewer: the implementing session (owner's full-autonomy rule),
reading the whole diff adversarially before the PR.

## Verdict

**Approved.** Every plan item is delivered and tested; two warnings found during the review were fixed
before the PR (F1, F2); the rest are suggestions kept as they are or sent to the followups roadmap.

## Dimensions

| Dimension | Result |
| --- | --- |
| Outcome | `shots [<id>]` renders `screenshots[]` with width, height, full page with a lazy-load scroll, motion; status, phrase and size gates; English flags and messages |
| Correctness | gates tested both ways at their boundaries (399/400, minBytes ± 1) and in a real browser |
| Ownership | new code in `src/screenshot/`; `src/cli/` changed only to expose the command; MK-3/6/7 folders untouched; no schema change |
| Conventions | result union per entry, `CliOptions` as a discriminated union, messages name the entry, the gate and the input |
| Architecture test | no fixed scale, scheme, locale or zone in `src/` (passes) |
| Tests in CI | `PLAYWRIGHT_CHROMIUM_PATH` on the `test` job; a missing path fails instead of skipping |
| Docs | README: command, gates table, output, limitations, development note |

## Plan coverage

| Plan item | Where |
| --- | --- |
| Gate checks | `src/screenshot/gates.ts` |
| Capture, scroll, motion, hidden selectors | `src/screenshot/screenshot.ts` |
| `shots` command and flags | `src/cli/options.ts`, `src/cli/main.ts` |
| Shared app start (the roadmap's unknown) | `src/cli/server.ts`: `ensureServer(config, { url, ownUrl })` |
| Fixture entry (plan review W3) | `examples/fixture/marketing.json`, `minBytes: 5000` |
| No `deviceScaleFactor` literal (plan review W1) | Playwright's default scale |
| Tests | `tests/screenshot.test.ts` (14), `tests/shots-cli.test.ts` (3), `tests/options.test.ts` (+11) |
| Manual 2.3 | the fixture PNG (1280×800, 16 kB) shows the calculator in the dark scheme |

## Findings

### F1 [WARNING] A page that never settles crashed the command with a stack

`waitForLoadState("networkidle")` after the scroll and the phrase reads can time out on a page with
long polling; the error escaped `takeScreenshots` and the CLI printed a stack instead of a gate failure.
**Fixed:** Playwright timeouts after the navigation become the `load` gate (`capturing <url>: …`); any
other error still propagates as a bug.

### F2 [WARNING] `--url=localhost:3000` passed as an address

`URL.canParse("localhost:3000")` is true (scheme `localhost:`), so a common typo reached the server
check with a nonsense URL. **Fixed:** `--url` must be an `http:` or `https:` address; tested.

### F3 [SUGGESTION] Filter and validation code repeated between film and shots parsing

`--config` and `--url` checks appear in both branches of `readOptions`. Kept: merging them means
rewriting the film branch, which parallel items also edit; a small duplication is cheaper than the
conflict.

### F4 [SUGGESTION] Screenshots only at device scale 1 and one colour scheme

A retina capture or a light/dark pair needs schema fields. Not asked by the roadmap (frame.md option C);
added to the followups roadmap as FU-17.

## Gates

`npm run typecheck`, `npm run lint`, `npm test` (with a local Chromium), `npm run build`: green on the
final commit.
