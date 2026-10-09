# Plan: deploy-verify-app-checks

Input: change.md (research and framing skipped, reasons in change.md). Complexity: medium (one phase per concern).

## Goal

`deploy.json`'s `verify` routes take `severity`, `sha256`, `within`, `count` and `forEach`, and `verify` takes
`originSeverity`. The report shows `WARN` rows and the CLI exits 0 when only warnings failed.

## Key decisions

- **D1 Severity.** A route takes `severity: "fail" | "warn"` (default `fail`); `verify.originSeverity` does the same
  for the `--origin` row. A failed warn row prints `WARN`, the summary adds `, N warned` only when N > 0, and only
  fail-severity failures fail the run. Existing output is unchanged.
- **D2 Digest.** A route takes `sha256` (`sha256:<hex>` or 64 hex): the SHA-256 of the response's exact bytes must
  match. The body is read as bytes once and decoded as UTF-8 for markers.
- **D3 Scope.** `within: "head"` checks `contains`, `excludes` and `count` against the text between `<head…>` and
  `</head>` (case-insensitive); a response without a head has an empty scope, so markers fail with ` in <head>` in
  the detail. No `userAgent` key: `requestHeaders["user-agent"]` already sends a bot's agent.
- **D4 Count.** `count: { "<marker>": n }`: the marker occurs exactly n times (non-overlapping) in the scope.
- **D5 Loops.** A route without `path` takes `forEach`, one of:
  `{ "sitemap": "/sitemap.xml", "match": "/blog/" }` (every `<loc>` whose path contains `match`) or
  `{ "index": "/.well-known/agent-skills/index.json", "items": "skills", "url": "url", "digest": "digest" }`
  (defaults are the Agent Skills Discovery names; each entry's `digest` becomes the expanded route's `sha256`). The
  source is fetched with the route's request headers; each entry's path (and query) is requested on the verified
  URL's origin and gets its own row. An unreachable source, a non-200 answer, an unreadable document or no entry is
  one failed row naming the source. Exactly one of `path` and `forEach`.
- **D6 Validation.** `HEAD` refuses `count`, `sha256` and `within` like markers; `within` needs a marker or a count.
- **D7 Point 6** (Web Bot Auth) is filed as its own issue.
- **D8 Version 0.1.8** with #308 and #310: package, lockfile, CHANGELOG, the `deploy-cli-version` defaults; README
  section updated and the "stays in the app" paragraph trimmed; JSON schema regenerated.

## Phase 1: schema and pure checks

- [x] Tests first: schema accepts and refuses the new keys; `checkResponse` for digest, scope, count.
- [x] D2-D4, D6 in `schema.ts` and `checks.ts`.

## Phase 2: runner, report, CLI

- [x] Tests first: sitemap and index expansion against a local server, warn rows, CLI exit codes.
- [x] D1, D5 in `run-checks.ts`, `report.ts`, `verify-command.ts`.

## Phase 3: docs and version

- [x] D7, D8; gates: typecheck, lint, deploy and repo tests, build.

## Progress

- 2026-10-09: plan written.
- 2026-10-09: phases 1 to 3 done; point 6 filed as #341. `ObservedResponse.sha256` is optional so callers that
  build one (the agent-ready verify test) keep compiling.
