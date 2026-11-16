# Plan review: runtime-platform-contract

Verdict: proceed with two adjustments, applied to the plan.

1. **Warning, contract.** Module packages pin core with `^0.2.x` peers (auth `^0.2.4`); a 0.3.0 core falls outside
   them. The change is additive with defaults, so it ships as 0.2.8. Applied to the plan.
2. **Suggestion, test.** The walker must ignore `import type` and `export type` but not
   `import { type X, y }` (a value import with a type specifier). Applied to phase 2's fixture test.

No migration, no dependency change, no lesson contradicted (`context/foundation/lessons.md` read for config and
manifest rules).
