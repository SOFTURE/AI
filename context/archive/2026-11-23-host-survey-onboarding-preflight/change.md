---
change_id: host-survey-onboarding-preflight
title: "host: a read-only survey and an onboarding preflight for a server that already runs apps (issue #1432)"
status: archived
roadmap_item: null
issue: 1432
branch: claude/project-thread-kacn0h
created: 2026-11-23
updated: 2026-11-23
archived_at: 2026-11-23
---

## Intent

An operator who adds an app to a server that already runs other apps learns how that server is set up from
`softure-host survey` (read-only), and `softure-host app add` stops before any change, in `--check` too, when the
inventory's edge settings contradict the server or the app's compose file; a deploy user that sshd's `AllowUsers`
turns away gets an sshd drop-in that admits it, so the first release can log in on a server `server` never touched.

## Context

Issue #1432 (labels `enhancement`, `pkg: host`). Builds on #1431 (deploy-user preflight in `app.yml`, merged in
PR #1440) and #1429 (`app add` sets the repository variable `EDGE_NETWORK`, which `softure-deploy init --edge`'s
compose file reads). Only `server` puts the deploy user into sshd's `AllowUsers` (`vps_ssh_allowed_users`).

## Scope

- `softure-host survey --inventory=<file>`: one read-only shell probe over the admin's SSH connection; prints OS and
  Docker versions, users with groups and sudo rights, sshd `AllowUsers`/`AllowGroups`/`DenyUsers`/`DenyGroups`,
  running Traefik containers (compose project, networks, entry points, resolvers), Docker networks, `/srv/*`
  folders, the origin firewall; ends with a suggested `edge:` block when an edge already runs.
- `app add` preflight, before any change and in `--check`: an edge that is not the inventory's own runs while
  `edge.manage` is `true`; `edge.network` missing on the server; the app's compose file joining another external
  network (literal, or a `${VAR:-default}` that does not resolve to `edge.network`).
- `ansible/app.yml`: sshd check for the deploy user; `AllowUsers` without it → a drop-in
  `/etc/ssh/sshd_config.d/60-softure-host-<deployUser>.conf`, validated with `sshd -t` (removed on failure) and
  reloaded; `DenyUsers`/`DenyGroups`/`AllowGroups` that would still refuse it → stop before any change with the step
  left to the operator.
- `e2e/converge.sh`: a server with `AllowUsers root` (not provisioned by `server`); the issued key logs in after
  `app.yml`; `AllowGroups` refusal; `survey` through the CLI changes nothing (next converge `changed=0`).
- README section "Adding an app to a server that already runs apps", linked from the top; CHANGELOG `## Unreleased`.

## Constraints

- No change in the `softure.vps_foundation` collection, no change in any app repository.
- No release in this change: the host release is batched by the coordinator.

## Notes

- frame skipped: the issue names the problem, the impact and the fix with acceptance criteria; no product question.

## Done

- `softure-host survey --inventory=<file>`: read-only probe over the admin's SSH; users and sudo, sshd access, Docker
  networks, running Traefik (project, networks, entry points, resolvers), `/srv` folders, the origin firewall, and the
  `edge:` block for an edge that already runs.
- `app add` preflight before any change and in `--check`: a foreign edge with `edge.manage: true`, a missing
  `edge.network`, a compose file joining another network.
- `app.yml` admits the deploy user through an sshd `AllowUsers` drop-in (validated, reloaded) and refuses
  Deny*/AllowGroups conflicts before any change.
- `e2e/converge.sh` covers the drop-in, the login on an `AllowUsers root` server, the AllowGroups refusal and the
  survey. README section "Adding an app to a server that already runs apps". Release: `@softure-ai/host`
  (CHANGELOG `## Unreleased`).
