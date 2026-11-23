---
change_id: deploy-public-paths
title: "deploy, host: publicPaths in deploy.json, verify only public paths, bypass list from them (issue #1435)"
status: open
roadmap_item: null
issue: 1435
branch: claude/project-thread-lz308e
created: 2026-11-23
updated: 2026-11-23
---

## Intent

An app behind a login (Cloudflare Access or its own sign-in) passes its first release verify: `deploy.json` names the
paths that answer without a login (`publicPaths`), the generated verify checks only those, `softure-host app add`
turns them into the Access bypass list, and a verify route answered by a login redirect fails with a message that
says what to do.

## Context

Issue #1435 (no labels). `templates/deploy.json.tmpl` always verifies `/`; behind Access or an app login the release
fails verify while the app is healthy. `apps[].access.bypassPaths` in the host inventory is a hand-written second copy
of what the app knows.

## Scope

- `@softure-ai/deploy`: `deploy.json` gains `publicPaths` (schema and JSON schema); `init` fills it from what it
  detects (`/api/health` with `@softure-ai/ops`, the MCP and OAuth endpoints with `@softure-ai/mcp-access`, the
  unsubscribe page and route with `@softure-ai/mailing`) and `--public` (then `publicPaths: ["/"]`); the generated
  `verify.routes` checks `/` only with `--public`.
- `verify`: a route that expects no redirect and gets one to a login (Cloudflare Access, or a login/sign-in page)
  fails with `<path> is behind a login; list it in publicPaths or remove it from verify`.
- `@softure-ai/host`: `app add` reads `publicPaths` from the app's `deploy.json` on the default branch, adds them to
  `access.bypassPaths`, and reports paths in one list but not the other.
- READMEs and CHANGELOG `## Unreleased` of both packages.

## Constraints

- No release in this change (batched by the coordinator). No change to any app repository.
- Existing `deploy.json` files without `publicPaths` stay valid.

## Notes

- frame skipped: the issue names the defect, the impact, the fix and the acceptance criteria; no product question.
