---
change_id: theme-kit-maskable-icon-854
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (18f9c3c).

- Acceptance of #854: `shape: "maskable"` (full bleed, glyph in the 80 % safe zone), `glyphScale` and `strokeWidth`
  options, README manifest icons from a route handler. Covered by phases 1-2.
- Geometry: the limit `0.8 / √2` keeps the glyph box's corners inside the safe zone circle; the default 0.5 is the
  adopting app's value and sits inside it.
- Compatibility: existing defaults and signatures stay (`renderIconSvg` gains an optional third argument), so the
  release is a patch, as the themes' `^0.1.x` ranges need.
- Generic: the stroke width is a number, not a theme lookup; no theme-specific code enters the kit.
- Errors: exceptions only for misuse in the app's icon file (bugs), with the value and the limit in the message.

Verdict: approved, no changes.
