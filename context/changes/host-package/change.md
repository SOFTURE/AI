---
change_id: host-package
title: "Provision a shared app server and onboard an app with one command, on top of softure.vps_foundation (issue #524)"
status: in_progress
roadmap_item: null
issue: 524
branch: claude/project-thread-xj9lf0
created: 2026-10-15
updated: 2026-10-15
---

## Intent

Putting an app on a server takes about fifteen manual steps across the owner's machine, GitHub, the server and
Cloudflare, and the shared edge (Traefik, its network, the origin firewall) lives inside the first app's compose
project under that app's names. A new package, `@softure-ai/host`, turns both into one idempotent command each,
with a dry run: `softure-host server` converges a shared app server (the `softure.vps_foundation` Ansible collection
plus a generic edge), `softure-host app add` onboards one app (server folder, first `deploy.sh`, forced-command
deploy key, GitHub Environment and secrets, Cloudflare DNS and Access). Every shared name is a parameter with a
generic default (`softure-edge`), so no app's name leaks into another.

## Constraints

- Ansible inside, one CLI outside. The base server is not re-implemented: it is `softure.vps_foundation`.
- The three server-generic roles the collection lacks (`traefik_edge`, `cloudflare_origin`, `deploy_user`) land in
  SOFTURE/VPS_FOUNDATION first (its merge to master releases the next minor, 1.25.0); this package pins that tag.
- Owns `tools/host/` (new), one CI job in `.github/workflows/ci.yml`, the package line in `README.md`.
  Does not touch `tools/deploy/` (#516 owns `init --edge`).
- Nothing is released from this change (the coordinator batches releases).
- Secrets never reach argv, logs or disk: values go to `gh` on stdin; the generated deploy key lives in a
  temporary folder removed at the end.

## Notes

- Placement: issue mode, `roadmap_item: null`, issue #524.
- Framing: skipped. The issue states the problem, the steps done by hand and the target shape.
