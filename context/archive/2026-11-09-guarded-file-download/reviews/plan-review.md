---
change_id: guarded-file-download
verdict: approved
---

# Plan review (auto)

- Generic need (any app taking a file by URL), so it belongs in the package next to `fetchGuardedPage`.
- The refactor keeps the page fetch's behaviour; its full test file is the guard. Approved.
