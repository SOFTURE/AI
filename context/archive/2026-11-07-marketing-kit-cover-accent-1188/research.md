---
change_id: marketing-kit-cover-accent-1188
---

# Research

- `tools/marketing-kit/src/og/photo-cover.ts`: `getCoverInk(colors, tone)` returns `{ text, shade }` from
  `foreground` and `background` only; `buildTextTree` paints every line in `ink.text` and the pill box in
  `ink.shade` at alpha `0xd9`; `getLuminance` (WCAG relative luminance) already exists there.
- `resolveCoverText` already refuses a text its layout does not draw (a kicker outside `kicker-title`); an accent
  outside `kicker-title` and `pill` follows the same rule.
- The scrim under the kicker is `ink.shade` at alpha `0x8c` over the photo, plus a shadow in `ink.shade`; the
  issue asks the check "against the scrim, as the text is", so the kicker is checked against the opaque shade.
- The pill box is translucent (`0xd9`): a translucent accent would mix with the photo and the contrast check would
  not hold, so the accent box is drawn opaque.
- `BrandColors.accent` is a required role (hex, may carry an alpha; `toOpaqueHex` drops it).
- Tests: `tests/og/photo-cover.test.ts` decode the JPEG and read pixels over a black or grey photo; `COLORS` in
  `tests/og/helpers.ts` has `accent: "#cff26b"` (lime), foreground `#f2f3f5`, background `#0c0c0d`.
