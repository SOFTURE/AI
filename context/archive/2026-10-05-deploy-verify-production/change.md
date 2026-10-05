---
change_id: deploy-verify-production
title: "softure-deploy verify checks a deployed app against the routes in deploy.json"
status: archived
roadmap_item: DP-4
branch: claude/project-thread-s6wq8t
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

After a deploy, an app runs `softure-deploy verify https://example.com` and learns whether production answers as
it should. The checks come from the app's `deploy.json` (a zod schema, published as JSON Schema):

- every route answers with its expected status;
- body markers are present (and markers of a broken page are absent);
- redirects point where they should;
- headers are present with the expected value, or absent (for example `x-powered-by`).

The command prints one table row per route, a summary line, and exits non-zero when any check fails. A reviewer can
check it with the package tests, which run every check against a local HTTP server.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy), item **DP-4**:

> - **Outcome:**
>   - `deploy.json` (zod schema, published as JSON Schema): routes with expected status, body markers, redirects and headers;
>   - `softure-deploy verify <url>`: runs every check, prints a table, exits non-zero on a failure;
>   - FIRE's route lists stay in FIRE's `deploy.json`.
> - **Unknowns:** Which checks of FIRE's 548-line script are generic beyond routes (TLS, headers, robots).
> - **Baseline:** FIRE `scripts/verify-production.sh` (548 lines, 100+ of FIRE routes). After: the engine in TS with tests against a local server.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The split between package and app
(owner, 2026-10-04) is in [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md): the verify engine
goes into `@softure-ai/deploy`, the route lists stay in the app's `deploy.json`.

## Constraints

- Exclusively owns: `tools/deploy/src/verify/`, `tools/deploy/schema/`, `tools/deploy/scripts/`, and the new
  `verify` command file in `src/cli/`. The shared CLI entry (`src/cli/run.ts`) and the package files are merged from
  `master`; DP-2 and DP-3 run in parallel.
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish; the package stays `private` until DP-8. No request reaches a real production URL:
  tests use a local server only.
- FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy, item DP-4 (taken from `context/backlog/roadmap-deploy/`).
- Research: done (`research.md`), short: FIRE's script could not be read from this session, so the generic checks
  come from the roadmap, the extraction doc and HTTP semantics; the parity check is a `deploy-followups` gap.
- Framing skipped: the owner fixed the problem and the split (roadmap item and the 2026-10-04 decision); nothing
  about whether to build it is in doubt.
- FIRE parity of verify folded into DF-1 (`deploy-fire-parity`); DF-5 (`deploy-verify-cert-expiry`) queued in
  `deploy-followups` (DF-2 to DF-4 were taken by DP-2 and DP-7).
- Archived 2026-10-05: `@softure-ai/deploy` ships `softure-deploy verify` and `schema/deploy.schema.json`, waiting for its first publish (DP-8).
