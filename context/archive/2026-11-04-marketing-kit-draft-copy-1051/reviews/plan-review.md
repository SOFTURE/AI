---
change_id: marketing-kit-draft-copy-1051
verdict: approved
---

# Plan review: marketing-kit-draft-copy-1051

- Covers the issue's ask: with `crf` the `draft` film is copied, not encoded again (its first direction).
- Safe for other inputs: a picture outside H.264 yuv420p Constrained Baseline / Main / High is re-encoded to High as
  before; the post-check uses the same predicate, so nothing unpublishable passes.
- The log and CLI texts stop claiming High for a copied Baseline film.
- Tests cover the newly accepted profiles and the ones still rejected.
- Approved without changes.
