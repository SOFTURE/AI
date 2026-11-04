---
change_id: marketing-kit-draft-look-1050
verdict: approved
---

# Plan review: marketing-kit-draft-look-1050

- Covers all three asks of #1050 (brand font and colours, `highlight`, cached music with a `music` result) and the
  README note.
- Correctness: libass matches the font's own family, so reading name ID 1 instead of trusting `brand.fonts.body.family`
  is required; WOFF2 falls back with a log line rather than drawing in an unexpected face. Sharing the music lookup
  with `getMusic` keeps the cache keys identical, so a draft never misses a track the render would find.
- Spend: the draft never reaches `compose` / `scoreVideo`; the test counts provider calls.
- Compatibility: every option is optional and the `phrase` output stays byte-identical, so existing tests pin it.
- Approved without changes.
