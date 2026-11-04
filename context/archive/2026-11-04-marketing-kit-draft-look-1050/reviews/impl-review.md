---
change_id: marketing-kit-draft-look-1050
verdict: approved
---

# Implementation review: marketing-kit-draft-look-1050

- Done-when of #1050 met: a `highlight` film with a brand font and colours and cached prompt music drafts with the
  pill, the lit word and the ducked music, with no provider call (test counts `providers.music.calls`); an uncached
  prompt drafts without music and says so (`music: "not_cached"`, log line).
- The render's music lookup moved into `findFootageMusic`, which `getMusic` now uses, so the draft and the render read
  the same cache key; placeholder runs still skip generated music and keep a file source.
- libass gets the font's own family (name ID 1), tested with a family that differs from the brand's CSS name; a
  WOFF/WOFF2-only body font falls back to DejaVu Sans with a log line.
- `phrase` output is byte-identical without the new options (the existing ASS tests pass unchanged).
- Known gaps, documented in the README: square box per line, no pill shadow or pop-in, no colour fade back, no
  `captionMaxLines`, no loudness pass, end card, cover or sound effects.
- Approved.
