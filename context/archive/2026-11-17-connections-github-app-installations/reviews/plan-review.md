---
change_id: connections-github-app-installations
verdict: approved
---

# Plan review

- Scope matches change.md; no table, no migration.
- Risk: an app trusting the setup redirect's `installation_id`. Addressed by documenting the user-side check first in
  the README example and naming it the proof in the function's comment.
- Risk: Workers. The entry uses only WebCrypto, `atob`/`btoa` and core's `requestJson`; the repository's Workers-entry
  walker checks its imports once it is listed in `softure.workers`.
- Test gap check: wrong key, other App's key, uninstall, suspend, rate limit, outage, unreachable, spent code, a user
  who cannot reach the installation; all in phase 1.

Verdict: approved, no changes.
