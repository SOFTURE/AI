# Plan review: observability-non-error-reason-1142

Verdict: approved.

- Covers the issue's asks: full mode logs the text, label mode an explicit withheld marker, README the attribute route.
- `Error` values keep their attributes in both modes, so dashboards on `exception.type` do not move.
- Label mode stays free of free text: the marker carries only the kind, a class name and a code that passes the
  existing safe-code rule.
- The full-mode description cannot throw or grow without bound (circular, BigInt, cap at 1000 characters); a test
  pins each.
