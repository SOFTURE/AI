# Plan review: db-workers-connection

Verdict: proceed; one fix applied.

1. **Warning, contract.** `createProcessDatabase` (module-level `db`) uses the shared handle directly, not
   `getConfiguredDatabase`, so an app on Workers that uses it would bypass the scope. Fix: out of scope here, noted
   in the README as Node-only and refused on Workers by the same safety net (phase 1 covers `getSharedDatabase` too).
2. **Suggestion.** Lazy open in the scope keeps static pages from connecting; keep it.
