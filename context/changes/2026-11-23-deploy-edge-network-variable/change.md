---
change_id: deploy-edge-network-variable
title: "deploy: the edge network name reaches the compose file at deploy time (issue #1429)"
status: open
roadmap_item: null
issue: 1429
branch: claude/project-thread-uov6k2
created: 2026-11-23
updated: 2026-11-23
---

## Intent

An app generated with `softure-deploy init --edge=<network>` deploys to a server whose shared Traefik runs in a
differently named network without editing its committed compose file: the name comes from the deploy environment
(`EDGE_NETWORK`), `softure-host app add` sets it from the inventory, and the shared-host guard still checks such a file.

## Context

Issue #1429 (no labels). `init --edge` writes the network name as a literal in the top-level external network and in
`traefik.docker.network`. The name belongs to the server (`edge.network` in the host inventory), not to the app.

## Scope

- `tools/deploy` template: both places read `${EDGE_NETWORK:-<network>}`; README documents the variable.
- `checkSharedHostCompose` resolves `${NAME:-default}` / `${NAME-default}` (with an optional `env` option) in string
  values before applying its rules.
- `tools/host` `app add`: sets the `production` variable `EDGE_NETWORK` from `edge.network`, next to `APP_HOST`.
- Tests, READMEs, CHANGELOGs of both packages.

## Constraints

- An app that sets no `EDGE_NETWORK` deploys exactly as before (the default is the `--edge` value).
- No change in an adopting app's repository: migration is described in the CHANGELOG.

## Notes

- frame skipped: the issue names the defect and a fix the adopting app already proved; no product question.
