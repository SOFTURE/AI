---
change_id: deploy-shared-host-compose-guard-600
status: archived
---

# Plan: checkSharedHostCompose (issue #600)

Input: change.md, research.md. Complexity: small (one module, tests, docs).

## Phase 1: the guard (TDD)

Files: `tools/deploy/src/testing/shared-host-compose.ts`, `.test.ts` next to it, `src/testing/index.ts`,
`tools/deploy/package.json` (`yaml` dependency).

1. Tests first, one per rule and shape: the compliant `init --edge` file passes; missing / non-external / changed edge
   network (`driver`, `ipam`, `internal`); key or `name` match; legacy `external: { name }`; `ports` (short, long,
   loopback); `network_mode: host`; unprefixed router, middleware, service (map and list labels, `deploy.labels`,
   tcp); `fire` vs `firewall`; `traefik.docker.network` mismatch; bypass path behind `basicauth` direct and through a
   `chain`; a router whose `PathPrefix` does not cover the path passes; a hostless `PathPrefix(/mcp)` router claims;
   `!PathPrefix` exclusion; unreadable YAML and a non-mapping are one violation; bad options throw.
2. Implementation: parse with `yaml`, narrow `unknown` per field; pure functions per rule; violations sorted in file
   order (networks, then services in declaration order).

## Phase 2: docs

README "Edge network" (the guard and an example test) and the testing section; CHANGELOG `## Unreleased` with how an
app replaces its own guard.

## Progress

- [x] Phase 1: the guard (19 tests; the init --edge fixture passes; d9e9fae)
- [x] Phase 2: docs (README "Edge network" with the rule table, testing section, CHANGELOG `## Unreleased`)
