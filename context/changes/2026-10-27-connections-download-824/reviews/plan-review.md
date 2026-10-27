---
change_id: connections-download-824
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c91ca66).

- Scope covers every ask of the issue: method, optional JSON body, accept header, `Uint8Array` plus content type, a
  size cap, `/server` and `/next`, a `fetch` option, the same refresh and 401 rules and codes.
- No copy: the credential path is shared with `requestWithConnection` and the HTTP rules with `requestJson`.
- Safety: the cap is enforced while streaming, not after buffering; credential headers stay pairs; errors carry codes
  only.
- Compatibility: additive; `requestJson` and `requestWithConnection` unchanged (their tests stay as they are).
- Release note: connections must require the core version with `requestBytes`; recorded for the coordinator.

Verdict: approved, no changes.
