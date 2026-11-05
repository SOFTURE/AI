# Plan review: marketing-kit-segment-captions-1077

Verdict: approved.

- Every ask of #1077 maps to a phase: field and schema, validation, diff, render, draft, spanning rule, helper.
- Byte-identity for EDLs without the field is kept by construction (unchanged chunks emit the same markup and the
  ASS file adds no style) and is pinned by tests.
- The optional fourth `validateEdl` argument keeps existing callers working; `readEdlFile` passes it.
- Risk: the parallel #1079 change edits `pipeline.ts`, `index.ts` and the CHANGELOG; keep the edits there small.
