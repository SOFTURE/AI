---
change_id: host-preflight-cert-resolver
title: "host: the app add preflight compares the routers' certificate resolver with edge.certResolver (issue #1429)"
status: open
roadmap_item: null
issue: 1429
branch: claude/project-thread-uov6k2
created: 2026-11-23
updated: 2026-11-23
---

## Intent

`softure-host app add` (also with `--check`) stops before any change when a router of the app's compose file names
another certificate resolver than the inventory's `edge.certResolver`, naming the routers and both values.

## Context

A comment on issue #1429 widened its scope after #1430: compare the edge network of the compose file with the
inventory and the server, and the `tls.certresolver` labels with `edge.certResolver`. The onboarding preflight of
#1432 (PR #1442) already covers the network part (compose against `edge.network`, the network on the server); the
resolver comparison is missing.

## Scope

- `tools/host/src/survey/preflight.ts`: read the routers' resolver labels and add the problem to `checkOnboarding`.
- Tests, README (preflight list), CHANGELOG `## Unreleased`.

## Notes

- research skipped beyond reading `preflight.ts` and its tests: the preflight structure is fixed by #1432.
- frame skipped: the owner's comment names the check.
