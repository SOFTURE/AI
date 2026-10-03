# Implementation review: mk-core-port

Scope: full · Date: 2026-10-03 · Commits: 458f292..62f03bc (+ the F1 fix) · Gates: typecheck ✓ lint ✓ test ✓
(2008 passed, 12 skipped) build ✓ · Render: `MARKETING_KIT_RENDER=1` fixture test passed locally (84.6 s, Chromium
headless shell 1194 for hyperframes, Chromium 1194 for Playwright).

## Verdict

Ready after fixes. The package runs FIRE's pipeline from a config file: the six FIRE test files pass in English
(71 cases, with the two FIRE-app links stubbed), the CLI covers the six commands, and the fixture film renders a
10.5 s 1080×1920 draft MP4 with audio. One cheap fix applied (F1); two warnings accepted with an owner item each
(F2 to MK-2, F3 as FU-13); no critical finding.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS | F4 |
| Correctness | PASS | F1 |
| Tests | WARN | F3 |
| Migrations | PASS (none) | — |
| Security | PASS | — |
| Patterns and lessons | WARN | F2 |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Package and pure core | 458f292 | yes | `film`, `voiceover`, `timeline`, `compose`, `site-tokens`, `posts`, messages; `record.ts` came along (compose imports its types) |
| 2 Recorder, render and CLI | 310a012 | yes | config, options, films, voice, server, render, preflight, hyperframes; the roadmap row's `in_progress` stage fixed here (F4) |
| 3 Fixture and the draft MP4 | 62f03bc | yes | fixture app and film, `prepare.ts`, `render.test.ts`, README, FU-13 |

Files: planned and changed 46 · unplanned 1 (`tests/messages.test.ts`, placeholder parity across locales) · planned,
not changed 0.

Faithfulness checks: `voiceoverKey` equals FIRE's on a fixed input (`619a27159288f1e1`, FIRE run at 58e6c84);
`readSiteTokens` on a fixture with FIRE's `globals.css` layout returns the values FIRE's parser returns on the real
file; `record.ts` keeps FIRE's clock stepping, animation sync and timeouts line for line.

## Findings

### F1 [SUGGESTION] Output folder created through a `..` join
**Impact:** LOW · **Dimension:** Correctness · **Where:** `src/render/render.ts` (`renderFilm`)
**What:** `mkdirSync(join(input.output, ".."))` instead of `dirname(input.output)`.
**Why it matters:** it works, but reads like a path bug and breaks if `output` ever ends with a separator.
**Fix:** `dirname`.
**Decision:** fix now (archive commit).

### F2 [WARNING] The ported core throws instead of returning result values
**Impact:** MEDIUM · **Dimension:** Patterns · **Where:** `validateFilm`, `splitIntoBeats`, `readSiteTokens`, `filmTimes`, `composeFilm`
**What:** AGENTS.md asks for expected failures as values; FIRE's pure functions throw, and the port keeps them 1:1
(plan, Key decisions: "Error style"). The new code (config, options) returns results; the CLI turns both into one
line and an exit code.
**Why it matters:** a library caller (MK-3's declarative actions, an agent) has to catch.
**Fix:** move the validators to results when the config contract replaces them.
**Decision:** accept: MK-2 (`mk-config-contract`) rewrites validation; noted in the handoff to MK-2.

### F3 [WARNING] The end-to-end render does not run in CI
**Impact:** MEDIUM · **Dimension:** Tests · **Where:** `tests/render.test.ts`
**What:** the test is opt-in; CI's test job has no browser.
**Why it matters:** a regression in recording or composition would surface only at the next real film.
**Fix:** a CI job with a Chromium for both Playwright and hyperframes.
**Decision:** followup FU-13 (`marketing-kit-render-ci`), filed in 62f03bc.

### F4 [SUGGESTION] The roadmap row lacked its stage
**Impact:** LOW · **Dimension:** Plan coverage · **Where:** `context/foundation/roadmap.md` MK-1
**What:** the row was set to a bare `in_progress`; the roadmap contract test needs a stage. The full test run after
phase 1 failed on it (one test), so 1.2 is marked with 310a012, where it was fixed.
**Decision:** fixed (310a012).

## Handoff notes for MK-2

- Constants still in code: phone 390×844 @3 and the 9:16 frame (`compose/timeline.ts`), `pl-PL` and
  `Europe/Warsaw` and the hidden selectors (`record/record.ts`), `main` for the screen guard, the end card's arc
  logo and caption colours (`compose/compose.ts`), font file names, the three platforms (`film.ts`, `posts/posts.ts`).
- `isChannelCode` keeps FIRE's rule (`^[a-z0-9-]+$`, ≤ 20); analytics' default is `/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/`, ≤ 32.
- The voiceover language `pl` is part of the cache key (MK-7 makes it config; keep FIRE's keys valid).
