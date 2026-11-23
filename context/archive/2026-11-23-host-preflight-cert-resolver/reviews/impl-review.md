---
change_id: host-preflight-cert-resolver
verdict: approved
---

# Implementation review

- Acceptance: `tools/host` 110 of 110, typecheck and lint green.
- Labels read as list or map, on the service and under `deploy.labels`, like `checkSharedHostCompose`.
- An unset variable is reported by name, as the network check does; a matching file adds one note; no labels, nothing.
- The default inventory resolver (`letsencrypt`) matches what `init --edge` writes.
- README preflight list and CHANGELOG `## Unreleased` updated; the release rides the pending host batch.

Findings: none.
