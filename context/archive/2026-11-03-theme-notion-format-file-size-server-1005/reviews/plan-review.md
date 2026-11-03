---
change_id: theme-notion-format-file-size-server-1005
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #1005.

- Scope: one helper moved, one contract case, docs. No styling or component change, so nothing to mirror in the
  NOTION · Design System artifact (its bundle re-exports the root, which keeps `formatFileSize`).
- Fit: covers all three proposals of the issue. The guard is broader than "root exports" (it checks every client
  module), which also covers files a theme exports later; the only extra hit is named and tracked.
- Risks: the export regex misses `export default` objects and `export * from` inside a client module; none exist in
  the themes today, acceptable for a static guard. A PascalCase non-component value (e.g. a context object) would
  pass; contexts are already client-only by #770, so fine.
- Tests: the guard must fail on the current tree with exactly `notion/Upload.tsx: formatFileSize` (check it).

Verdict: approved.
