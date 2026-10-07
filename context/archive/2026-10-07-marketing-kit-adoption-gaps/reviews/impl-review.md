# Implementation review: marketing-kit-adoption-gaps

Reviewed: commits 57e82a2, 3827b09, 78d3113, ab0d251 against [`plan.md`](../plan.md) and issue #118.
Reviewer: Claude (self-review, owner's autonomous mode).

## Plan drift

None in scope. Two small additions, both to the plan's intent:

- Film commands now refuse a shots-only flag (`record a --wait=100` → "--wait applies to shots only"); before, the
  global flag list was shared, so a page flag would have passed silently on a film command.
- `--placeholder` is also refused with a value or on `voice`, `posts`, `preview` (plan review 6).

## Verification

| Check | Result |
| --- | --- |
| `npx vitest run tools/marketing-kit` (Chromium at `/opt/pw-browsers/chromium`) | 33 files, 509 passed |
| `MARKETING_KIT_RENDER=1` render test, hyperframes on the headless shell | 2 passed: the fixture film, and `all --placeholder` without any paid voiceover renders `fixture-tour.placeholder.mp4` with audio, leaves no `voiceover/` folder, and a plain `render` then refuses the placeholder recording |
| Scroll frame | `reveal.html`: the top frame fails the phrase gate, `scrollTo: 1800` passes with a 600 px frame; `scrollTo: 5000` on a short page fails the new `scroll` gate and writes nothing |
| Extra wait | `settling.html`: without `waitMs` the first state passes; with `waitMs: 1500` it fails and the settled state passes (the wait runs before the phrase gate) |
| Storage state | `/private` shows the phrase only with the cookie: anonymous fails, the storage state passes; missing, non-JSON and cookie-less files are refused before the browser, without quoting the file |
| Ad-hoc | `shots --page --out --expect` against a page outside the app writes an 800 px PNG and prints no `server:` line; a wrong phrase exits 1 and removes the file |
| Gates | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (see Progress commit) |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `--scheme` was narrowed with a cast after the check. | Fixed: narrowed with `COLOR_THEMES.find`, no cast. |
| 2 | Suggestion | The placeholder is regenerated on every `record` and `render` (one ffmpeg call, under a second). Caching it would add a staleness rule for a file that costs nothing. | Kept as is. |
| 3 | Suggestion | `shots --page` loads `marketing.json` for the browser settings, so a page outside any app still needs a config. Every adopting app has one; a config-free mode would duplicate the brand defaults. | Kept as is; README says which settings apply. |
| 4 | Warning | A storage state holds a live session. | Never printed (the parse error is replaced by the path), README says to keep it out of git. |

No open blocking finding.

## Issue #118, item by item

| Item | Done by |
| --- | --- |
| 1 ad-hoc shots | `shots --page` (3827b09) |
| 2 scroll frame, extra wait | `scrollTo` + `scroll` gate, `waitMs` (57e82a2); `--scroll`, `--wait` (3827b09) |
| 3 authenticated screens | `storageState` (57e82a2), `--auth` (3827b09) |
| 4 Chrome cache path | README Requirements (ab0d251) |
| 5 FIRE's pre-redesign look | README "From FIRE_TRACKER's constants" without the old values (ab0d251) |
| 6 npm, `npx` advice | on npm since 0.1.7 (MK-8); README "Install" (ab0d251) |
| 7 renderable dry-run voiceover | `--placeholder` (78d3113) |
