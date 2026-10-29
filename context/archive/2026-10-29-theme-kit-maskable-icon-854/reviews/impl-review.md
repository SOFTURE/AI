---
change_id: theme-kit-maskable-icon-854
verdict: approved
---

# Implementation review

Reviewed the diff from 18f9c3c against plan.md.

- Acceptance of #854: `shape: "maskable"` draws full bleed with the glyph at 0.5 of the side; `glyphScale` and
  `strokeWidth` are optional with the defaults of #839 kept for `rounded` / `square`; the README has `app/manifest.ts`
  and a route handler serving 192, 512 and maskable 512. `MANIFEST_ICON_SIZE`, `MANIFEST_LARGE_ICON_SIZE` and
  `MASKABLE_SAFE_ZONE` are exported from `/next`.
- Geometry: the maskable limit `MASKABLE_SAFE_ZONE / √2` is accepted at its exact value and refused above it (tests).
- Errors: invalid scale and stroke throw with the value and the limit; `strokeWidth` with `{ svg }` markup throws
  instead of being ignored. Both are misuse in an app's icon file, so exceptions fit the conventions.
- Markup safety unchanged: the stroke width is a checked finite number before it enters an attribute.
- Compatibility: `renderIconSvg` gains an optional third argument; nothing else changes shape, so a patch release fits.
- README route example: type-checked in the repository against `next` 16 and the kit's sources (scratch copy,
  removed). No `next build` proof, as planned.
- Gates: typecheck, lint and language green on commit; `npm test` runs in the pre-push hook.

Verdict: approved, no changes.
