---
change_id: marketing-kit-draft-threads-1024
verdict: approved
---

# Plan review: marketing-kit-draft-threads-1024

- Covers both asks of #1024: `-threads N` per input and for the encoder plus `-filter_complex_threads N`, default
  unchanged; the same validation as `normalize.threads`.
- Correctness: `-threads` is positional in ffmpeg, so the per-input copy must precede each `-i` and the encoder copy
  the output file; the plan places all three and the tests pin them. Putting `-threads` before `-ss` keeps the
  existing seek test's offsets valid.
- Compatibility: new optional options only; the normalize error message is unchanged.
- Approved without changes.
