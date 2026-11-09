---
change_id: guarded-file-download
verdict: approved
---

# Implementation review (auto)

- The guard is the page fetch's own code path (`followGuardedRedirects`), so every hop is checked in the socket's
  lookup; `requireHttps` is checked on every hop before connecting.
- Memory: the body is never collected; one chunk at a time reaches `consume`.
- Errors: body failures (`BodyStreamError`, `GuardedFetchError`) and the timer map to codes even when `consume`
  rethrows them; other `consume` errors propagate (tested).
- Evidence: `npx vitest run modules/security` all green; coverage of the new files 100 % lines and branches.
