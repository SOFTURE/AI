---
change_id: stripe-sandbox-diagnostics
verdict: approved
---

# Implementation review (auto)

- The failure step runs only on failure and never fails itself (`|| true`, find over an existing folder); the listener log copy is already sanitized of its signing secret before it is printed.
- The wrapper keeps the original error as `cause` and the same 60 s timeout. Approved.
