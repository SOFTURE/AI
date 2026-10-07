---
change_id: marketing-kit-fill-clear
title: "marketing-kit: fill replaces a prefilled value, and a press action for single keys"
status: archived
roadmap_item: null
branch: claude/project-thread-wt1v71
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

A scene written as `actions` can change a field the app prefills. `fill` replaces the field's value instead of
appending to it, and the viewer sees the old value go before the new one is typed. A scene that wants to show the
deletion itself, or needs any other key (Enter, Tab, Escape, an arrow), has a `press` action and no longer needs a
`sceneModule` for one keystroke.

## Context

Source: GitHub issue SOFTURE/AI#175 (filed by the owner 2026-10-07), from FIRE_TRACKER SF-1 (`social-films-batch`,
2026-10-06) on marketing-kit 0.1.6-0.1.8. FIRE's wizard prefills `intentAge` with `45`; `fill intentAge 50` recorded
`4550`. Cause in the code: `src/record/record.ts` `fill` taps the input and types key by key; a tap does not select
the content and nothing clears it. `page.keyboard.type("\b")` inserts a literal character, and no action presses a
key, so FIRE had to keep the default 45 in its films.

## Constraints

- Owns: `tools/marketing-kit/src/record/`, `src/film.ts` (`Director`), `src/config/actions-schema.ts`,
  `schema/marketing.schema.json`, the tests, the README and the package version.
- A film whose `fill` targets an empty field records exactly as before: the same frames, taps, keys and camera.
- Every key the recorder presses is logged in `keys` (the composition plays a key sound for each) and held on screen,
  like typed characters.
- The JSON twin and the TS scene stay 1:1: `press` and `fill`'s new option are Director calls of the same name.
- The package version bumps (0.1.9); the owner publishes.
- FIRE_TRACKER is read only from this repo; its adoption is FIRE's own change.

## Notes

- Decision (auto): placement → issue-driven change, `roadmap_item: null` (`context/foundation/roadmap.md`: no
  active roadmap since 2026-10-07).
- Decision (auto): both suggestions of the issue, not one of them: `fill` clears by default (`clear`, default
  `true`) and a `press` action exists (research §3).
- Framing skipped: the problem, its cause and the wanted outcome are measured and stated in the issue.
- Research done ([`research.md`](research.md)).
- Archived 2026-10-07: `fill` selects and deletes a prefilled value on screen before typing (`clear`, default
  `true`), fails when the app puts a value back, and a `press` action sends any key. Empty fields record as in 0.1.8.
  marketing-kit 0.1.9 waits for the owner's release. Closes issue #175.
