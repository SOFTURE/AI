---
change_id: marketing-kit-mouth-clicks-1182-1183
verdict: approved
---

# Implementation review (auto)

- #1182: `findMouthClicks` and `MOUTH_CLICK_RULES` exported from the root; tests per rule in `mouth-clicks.test.ts`
  (energy zone at onset and decay, -45 dBFS with the click's samples left out, a breath, periodicity, length, end,
  band floor on digital silence, offset). The 0.18.0 levels are unchanged: their tests pass with only the report's new
  `skippedLimit: 0`.
- #1183: the `repair` level's tests cover every acceptance line (151 vs 140 ms pause, a click in a decay the
  transcript cut short, a -40 dBFS breath, 3 of 5 in one second with 2 skipped, the 1 % budget, a periodic tone, and
  speech with bounds 20-60 ms inside the sound: only the repairs change, none in the energy zone).
- Evidence: `npx vitest run` over the declick, mouth-click, draft, pipeline, config and architecture tests (152
  passed); `npm run typecheck`; ESLint on the changed files; `npm run lint:language`.
- Approved.
