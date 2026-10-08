# Plan review: deploy-verify-header-lists

Reviewed: plan.md against change.md, issue #292 and `tools/deploy/src/verify/` on master (48e8fa5).

## Findings

1. **Warning, accepted — empty array semantics.** Without D2, `"link": []` would parse and pass for any response,
   including one without the header, while a reader may take it for "absent". Fix: the schema refuses `[]`
   (already D2); the test asserts the error path. Applied in the plan.
2. **Suggestion, accepted — missing header with an array.** One outcome per item when the header is missing repeats
   "missing link" four times. Considered collapsing it into one outcome; kept per item (D1) because the issue asks
   for one detail per item and the report is one row either way. No change.
3. **Suggestion, rejected — merge global and route arrays.** Merging would let a route only tighten a global check;
   today a route's entry can also loosen it. Changing that rule is out of the issue's scope (D3). No change.
4. **Check — backwards compatibility.** A string value takes the same code path and detail text; the generated JSON
   Schema gains one `anyOf` branch. The schema test pins the committed file. No finding.
5. **Check — lessons and conventions.** No migration, no external input beyond the zod boundary that already
   exists, English only. No finding.

## Verdict

Ready to implement after finding 1 (already in D2).
