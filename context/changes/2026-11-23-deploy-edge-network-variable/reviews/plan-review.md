---
change_id: deploy-edge-network-variable
verdict: approved
---

# Plan review

- Scope matches issue #1429's three proposals; nothing in an adopting app changes.
- Backward compatible: without `EDGE_NETWORK` compose falls back to the `--edge` value, and the guard without `env`
  resolves the default, so existing literal files and new files both pass.
- The edge-proof rule keeps working: `${EDGE_PROOF_SECRET:?}` is not a default form and stays non-empty.
- `env render` already writes optional names from `vars`; no workflow change needed (checked in research).
- Tests fail before the change (guard reports `edge-network-missing` and `traefik-network` for the placeholder).

Verdict: approved, no changes.
