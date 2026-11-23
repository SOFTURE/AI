---
change_id: deploy-host-scoped-npx
title: "deploy, host: operator docs and CLI messages run the CLIs through the scoped, pinned package (issue #1436)"
status: in_progress
roadmap_item: null
issue: 1436
branch: claude/project-thread-to3t91
created: 2026-11-23
updated: 2026-11-23
---

## Intent

An operator who copies a command from the `deploy` or `host` README, or from a line the `host` CLI prints, runs it
anywhere and gets the published `@softure-ai/*` package at a pinned version. No operator-facing example or CLI
message outside an app context uses `npx softure-deploy` / `npx softure-host`, which npm resolves to an unscoped
package nobody in this project owns.

## Context

Issue #1436 (no labels). `deploy` and `host` ship bins `softure-deploy` and `softure-host`. `npx <bin>` finds the bin
only inside a project that depends on the package; elsewhere npm looks up an unscoped package of that name.

## Scope

- `tools/deploy/README.md`: a "Running the CLI" section (inside an app vs anywhere else, pinned version).
- `tools/host/README.md`: the same section; the top examples use `npx --yes @softure-ai/host@<version> …`.
- `tools/host` CLI: the `server` next step prints the scoped, pinned `app add` command; `app add`'s "no deploy.sh"
  message names the in-app form explicitly.
- Tests pinning both messages; CHANGELOGs of both packages.

## Constraints

- Reserving the unscoped names on npm is out of scope (owner's decision); mentioned on the issue as an option.
- No behaviour change beyond the printed text.

## Notes

- frame skipped: the issue names the defect and the fix; no product question.
