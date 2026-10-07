# Implementation review: marketing-kit-fill-clear

Verdict: **approved**.

## Against the plan

| Phase | Planned | Done | Evidence |
| --- | --- | --- | --- |
| 1 | `fill` clears a prefilled value, `clear: false`, a `press` action, the field that refills itself fails, README, 0.1.9 | yes | `src/record/record.ts` (`press`, `fill`, `KEY_SECONDS`), `src/film.ts` (`Director.press`, `fill` options), `src/record/actions.ts`, `src/config/actions-schema.ts` (`press`, `fill.clear`); `tests/record.test.ts` (Chromium), `tests/actions.test.ts`, `tests/actions-schema.test.ts`; README (actions table, upgrade note); JSON Schema regenerated; 0.1.9 |

## Verification

- Red first: the five recorder tests failed on `master`'s recorder (`prefilled` held `4550`, no `press`), the schema
  tests failed on the unknown `press` action.
- Real browser, not a double: `tests/record.test.ts` records against a page with a prefilled `type="number"` field
  in a touch phone context, and reads the field's value afterwards (`50`; `4550` with `clear: false`; empty after
  `press Backspace ×2`).
- Empty fields unchanged (plan review P1): a `fill` on an empty field logs the same keys, taps and frame count as the
  0.1.8 sequence written out (tap with 0.2 s, then type).
- Desktop: the spike (research §2) ran the same keys in a mouse context with the same result; `ControlOrMeta` is
  Playwright's own switch.
- Gates: typecheck, lint (with the language gate), test, build.

## Findings

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| I1 | The error for a field that refills itself names the Playwright locator (`locator('input[name=stubborn]')`), not the bare selector. | note | Kept: the same form as the recorder's other locator errors; the action error adds the JSON path in front. |
| I2 | `type` with `\b` still inserts a literal character (issue). | note | Out of scope: `press` is the way to send a key; the README names the key names. |

## Manual checks for the owner

- After the 0.1.9 release, in FIRE_TRACKER: a film that sets `intentAge` to `50` with `fill`; watch that the old `45`
  is highlighted and goes before `50` is typed.
