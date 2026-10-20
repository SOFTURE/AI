---
change_id: ui-icon-toggle-state-623
status: done
verdict: approved
---

# Implementation review: ui-icon-toggle-state-623

- Acceptance met: `EyeOffIcon` (eye + `m3 3 18 18`), pressed look at `[aria-pressed=true]` in both tones with hover kept,
  `IconProps` pinned by a test, README and CHANGELOG with the migration.
- Compiled CSS checked: `[aria-pressed=true]` rules and `[aria-pressed=true]:not(:disabled):hover` rules for the fill and
  text are in `dist/styles.css`, so the pressed hover outranks the tone hover.
- Edge cases: `aria-pressed={false}` and `"mixed"` do not match the variant and keep the old look; disabled + pressed
  keeps the fill at half opacity like every disabled control; bordered + pressed keeps its border and adds the ring.
- Server-safe: no hooks or directive added to `button.tsx` or `icons.tsx`.
- Gates: typecheck, lint, language green in the hooks; the ui tests pass; `npm test` runs in the pre-push hook.

Verdict: approved, no changes.
