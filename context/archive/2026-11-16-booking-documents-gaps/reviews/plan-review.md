# Plan review: booking-documents-gaps

Verdict: approve with two fixes applied.

1. Warning: a port other than 443 reaches the guard as `security.outbound_blocked`, which would read as an SSRF
   refusal. Fix: `saveFileFromUrl` checks `https:` and the default port itself first (`files.url_not_allowed`).
   Applied in the plan's phase 1.
2. Warning: a kept-files path under `/api/` would be skipped by the worker's exclusion. Fix: the kept-files match runs
   before the exclusion. Applied in phase 2.
3. Suggestion: the viewer's PDF engine is heavy; load it only when a PDF opens and keep it injectable. Applied.
