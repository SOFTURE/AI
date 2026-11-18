# Implementation review: DetailTable fit and DocumentRow details

Verdict: approve.

- Matches the plan and both asks of #1349: `table-fixed` on `DetailTable`, optional `details` on `DocumentRow`
  inside the open button after the size; no existing prop changes.
- The regression is guarded by geometry, not pixels: the fit check fails without the fix.
- Accessibility: `details` is part of the open button's name (every visible word), as the size already is; the
  muted text uses the theme's `muted-foreground` pair; axe passes on the gallery in light and dark.
- No finding left open.
