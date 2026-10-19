---
change_id: deploy-shared-host-compose-guard-600
title: "deploy: checkSharedHostCompose, a compose guard for an app on a shared edge proxy (issue #600)"
status: archived
roadmap_item: null
issue: 600
branch: claude/project-thread-s8tp95
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #600](https://github.com/SOFTURE/AI/issues/600): an app that runs next to another app's Traefik on one
host keeps a hand-written guard over its production compose file. Only the edge network, the name prefix and the
bypass paths are app-specific, so `@softure-ai/deploy/testing` exports the guard:
`checkSharedHostCompose(composeYaml, { edgeNetwork, namePrefix, bypassPaths }): ComposeViolation[]`.

## Context

Labels: `enhancement`, `pkg: deploy`. deploy 0.4.2 is the latest on npm and on master. Releases are batched by the
coordinator: no version bump here, the CHANGELOG gets `## Unreleased`. `init --edge=<network>` (issue #516) already
writes such a compose file; its README section "Edge network" is where the guard is documented.

## Acceptance

- `checkSharedHostCompose` is exported from `@softure-ai/deploy/testing` with its option and violation types.
- It returns an empty list for a compliant compose file (including the one `init --edge` writes without a database)
  and one violation per breach, each naming the rule and the service (or `null` for a top-level breach):
  - the edge network is missing, not `external: true`, or declared with anything besides `external` and `name`;
  - a service publishes `ports` or uses `network_mode: host`;
  - a Traefik router, middleware or service name lacks the prefix; `traefik.docker.network` names another network;
  - a router that serves a bypass path carries a blocking middleware (auth or allow list), or claims a bypass path
    without a `Host` matcher (so on every host of the shared proxy).
- A file that is not YAML, or not a mapping, is one violation, not an exception. Invalid options throw.
- README "Edge network" and `## Library`-adjacent testing section document it; CHANGELOG `## Unreleased` says how an
  app replaces its own guard.

## Notes

- Framing: skipped. The issue states the problem, the rules and the API.

## Decisions (auto)

- No `deploy.json` key (the issue makes it optional): the guard runs in the app's own test suite, which
  `deploy-release-checks.yml` already runs before every release, so a config key would run the same check twice and
  need the compose path in two places.
- The YAML is parsed with `yaml` (already in the lockfile, used by `blog` and `host`), not a hand-written reader:
  labels come as a map or a `key=value` list and networks in several shapes.
- A name "carries the prefix" when it equals the prefix or starts with `<prefix>-` (a prefix already ending in `-` is
  taken as is), the shape `init --edge` writes (`<name>`, `<name>-www`, `<name>-security-headers`); `fire` does not
  pass `firewall`.
- "Claims" a bypass path is read as: a router whose rule matches the path and has no `Host` matcher, so it takes the
  path on every host the shared Traefik serves. "Blocks" is a blocking middleware (`basicauth`, `digestauth`,
  `forwardauth`, `ipallowlist`, `ipwhitelist`, also through a `chain`) on a router that serves the path.
- A loopback port (`127.0.0.1:5432:5432`) is a violation too: it is a host port the neighbour may hold. The README
  points to `database.access: compose-exec`.
