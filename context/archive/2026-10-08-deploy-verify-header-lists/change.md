---
change_id: deploy-verify-header-lists
title: "deploy verify: several required substrings for one header (issue #292)"
status: archived
roadmap_item: null
issue: 292
branch: claude/project-thread-holg18
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

A header check in `deploy.json` (`verify.headers`, a route's `headers`) is `string | null`: one substring per header
name. A header that carries several directives a deploy wants pinned at once (`link` with four `rel` values,
`cache-control: private` and `no-store`, `vary: accept` and `accept-encoding`) needs one route per substring today,
so one request and one report row per substring ([#292](https://github.com/SOFTURE/AI/issues/292)).

After this change a header check also takes a non-empty array of substrings: the check passes when the value
contains every item (case-insensitive, as today); `null` still means the header must be absent. The route stays one
row in the report, with one check (one detail) per item.

A reviewer checks `tools/deploy/src/verify/` (schema and checks with their tests), the regenerated
`schema/deploy.schema.json`, the README section on verify, the CHANGELOG and the version bump (deploy 0.1.6).

## Context

- `headerChecksSchema` in `src/verify/schema.ts` serves both `verify.headers` and a route's `headers`;
  `mergeHeaderChecks` lets a route's entry replace the global one for the same name.
- `checkHeader` in `src/verify/checks.ts` returns one `CheckOutcome` per header name; the report prints each
  outcome's detail under the route.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backwards compatible: every existing `deploy.json` parses and reports exactly as before.
- Only `@softure-ai/deploy` changes; bumps it 0.1.5 → 0.1.6, released by this thread after the merge.

## Process notes

- Research: skipped as a separate artefact. The issue names the schema and the behaviour; the reading needed (two
  files and their tests, the README section) fits in `plan.md` § Findings.
- Framing: skipped. The problem is not in doubt and the issue's proposal is the smallest change that solves it; the
  alternative (keep repeating routes) is the workaround the issue reports as costly.
