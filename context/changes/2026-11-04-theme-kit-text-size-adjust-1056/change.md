---
change_id: theme-kit-text-size-adjust-1056
title: "theme-kit: base.css sets text-size-adjust: 100% on html (issue #1056)"
status: open
roadmap_item: null
issue: 1056
branch: claude/project-thread-kgel3t
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1056](https://github.com/SOFTURE/AI/issues/1056): Tailwind's full preflight sets
`-webkit-text-size-adjust: 100%` on `html`; the kit's scoped `preflight.css` leaves `html` alone and neither
`base.css` nor a theme's `page.css` sets it, so mobile Safari autosizes the text of blocks wider than the viewport (a
`Table` scrolling sideways renders its cells at about 1.6x). `base.css` sets it on `html`.

## Context

Labels: none yet (gap of `@softure-ai/theme-kit`, found in an adopting app). Every theme re-exports `base.css` under
its own name, so every theme's apps get the fix with the kit's next release. No version bump: the coordinator
releases the batch.

## Constraints

- In `@layer base`, so an app can still override it.
- Only `html` gains a rule; nothing else in the sheet changes.
- No change to an app's repository; migration notes in CHANGELOG and README.

## Notes

- Framing: skipped. The issue names the problem, the cause and the fix.
