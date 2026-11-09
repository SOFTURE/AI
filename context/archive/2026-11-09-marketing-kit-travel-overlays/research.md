---
change_id: marketing-kit-travel-overlays
---

# Research

- Overlays live in `src/footage/overlay-schema.ts` (zod), `overlays.ts` (placement, timing guards, resolved
  overlays), `overlay-html.ts` (render markup and GSAP tweens), `draft-overlays.ts` (libass events) and are wired
  through `compose.ts`, `draft.ts` and `pipeline.ts`.
- Placement is computed once and shared by render and draft, so new kinds get one placement each and both drawers
  read it; the timing guards (one at a time, spacing, no segment crossing) apply to every kind today.
- A hook title must run from 0 s across cuts beside the opening keyword, so it needs an exemption from those guards
  and its own guard (no second hook, nothing drawn in its box while it shows).
- Typing is drawn per character: render hides characters with opacity and staggers them in; the draft emits one
  event per step with the untyped rest transparent (`\1a&HFF&`), so both keep the final layout from the first frame.
- Counter formatting uses `Intl.NumberFormat` by the brand's locale; non-breaking spaces become plain spaces so the
  fonts' glyph check passes.
- The glyph check (`findMissingCaptionGlyphs`) must cover overlay text per role.
