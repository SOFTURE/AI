---
change_id: host-operator-keys
verdict: approved
---

# Plan review

- Covers all three proposals and the three acceptance criteria of issue #1433.
- Safety: only lines matching the owned comment are written; labels cannot collide with the role's `-release` regexp
  or with another app's comment; every written line carries `restrict` and the app's own `deploy.sh`.
- The duplicate-key refusal is checked on the server, in the same run as the write.
- Key validation decodes the body and checks its embedded type, so a pasted private key, an options-prefixed line or a
  truncated body is refused before anything connects.
- `list` is read-only and uses the same BatchMode admin connection as `readHostKeys`.
- Test-first: phase 1 helpers and phase 2 CLI tests exist before code; the e2e proves the forced command and refusals.

Verdict: approved, no changes.
