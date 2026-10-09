---
change_id: deploy-verify-app-checks
title: "deploy verify: warn severity, sha256 digests, checks within <head>, count, loops over a sitemap or an index (issue #309)"
status: archived
roadmap_item: null
issue: 309
branch: claude/project-thread-yamnin
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

`softure-deploy verify` expresses the checks an adopting app still keeps in a shell script after moving its simple
checks to `deploy.json`: a check that only warns, a served file that must match a published SHA-256, markers that must
sit inside `<head>`, an exact count of a marker, and one route repeated for every matching sitemap entry or every entry
of a digest index (Agent Skills Discovery).

## Context

Issue [#309](https://github.com/SOFTURE/AI/issues/309), points 1 to 5. The engine is `tools/deploy/src/verify/`
(schema, pure checks, runner, report) and the CLI `src/cli/verify-command.ts`. A bot's user agent is already a
`requestHeaders["user-agent"]` entry (0.1.4), so point 3 needs only the `<head>` scope.

## Constraints

- Backwards compatible: a `deploy.json` valid for 0.1.7 checks the same and prints the same table.
- No new dependency; the sitemap and the index are read with plain parsing (`<loc>` elements, `JSON.parse`).
- `#308` and `#310` change the same package in parallel: one unreleased version (0.1.8) shared, the second to merge
  folds its CHANGELOG lines into the existing section.
- English only.

## Notes

- Research: skipped; the issue names the five checks and the engine is one folder read in full for this change.
- Framing: skipped; the problem is concrete (shell checks an app keeps).
- Point 6 (a response to a request signed with Web Bot Auth) needs a signing key in the verify run and code from
  `@softure-ai/agent-ready`; it is split into issue #341 so this change closes the expressible part of #309.
- Archived 2026-10-09: points 1 to 5 are verify keys in 0.1.8; point 6 is #341.
