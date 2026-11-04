---
change_id: marketing-kit-caption-anchor-1026
verdict: approved
---

# Plan review: marketing-kit-caption-anchor-1026

- Covers asks 1 and 2 of #1026 and the metrics half of 3; the `captionChunks` bounds are left out with a reason
  (research, option 3).
- Correctness: measuring in the page is the only way to know wrapping with the brand font; hyperframes keeps hidden
  clips in layout and waits for fonts, so the fit runs before the first frame. The fit must also run after fonts load,
  since the first pass may measure the fallback font.
- Compatibility: `bottom` is optional and absent from the tables, so layouts without it render as before. The presets
  change: a one-line card now sits at the zone's edge instead of about one line above it. This is the intent of a
  preset (its foot at the edge) and goes in the CHANGELOG.
- The draft keeps its font size under a line limit; documented as a preview difference.
- Approved without changes.
