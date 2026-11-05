---
change_id: mcp-access-request-diagnostics-1066
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (e56019b).

- Acceptance of #1066: an option turns it on (phase 1), the test asserts the fields for `initialize`, a current
  session, a stale session and no session, and that no token or argument value is logged (phase 1); the README
  states what hosted clients do, from the public reports in research.md (phase 2).
- Default path unchanged: the extra body read happens only with diagnostics on; the existing 1055 tests guard the
  session behaviour.
- Risk: logging client-supplied text; cut and stripped of control characters, so a client cannot forge log lines.
- Risk: a throwing sink would turn a served request into a failure; it is caught and logged.

Verdict: approved, no changes.
