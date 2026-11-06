---
change_id: marketing-kit-photo-cover-layouts-1163
verdict: approved
---

# Plan review (auto)

- Scope matches the issue: the six layouts, `kicker`, `tone`, the scrim following the text, refusal instead of
  clipping, default behaviour unchanged, README examples. Nothing beyond it.
- Compatibility: no `layout` keeps both of today's behaviours; `tone` absent keeps today's ink. Existing tests stay.
- Risk: the pixel oracle now measures the pill's box too; that is wanted (the box must stay in the band).
- Risk: rendering six layouts at 1080×1920 adds test time (about 0.3 s each); acceptable.
- Approved.
