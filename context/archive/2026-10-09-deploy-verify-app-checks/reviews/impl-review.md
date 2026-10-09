# Implementation review: deploy-verify-app-checks

Reviewed: the branch diff against plan.md and issue #309.

- D1: `severity` and `originSeverity` default `fail`; `WARN` rows; the summary adds `, N warned` only when N > 0;
  `verify-command.ts` fails only on fail-severity rows (CLI tests for both).
- D2: the body is read as bytes once; the digest test with a byte order mark proves the bytes, not the decoded text,
  are hashed.
- D3, D4: `within: "head"` and `count` in `checks.ts`, pure and tested; a response without a head has an empty scope.
- D5: `forEach` sitemap and index loops in `run-checks.ts`, tested against a local server, including the failure rows.
- D6: schema refines tested (path xor forEach, HEAD, within without checks).
- D7: #341. D8: 0.1.8 in package.json, lockfile, CHANGELOG, workflow defaults, README; schema regenerated.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Minor | `VerifyRoute.path` is optional in the type; a TypeScript caller that reads it needs a narrowing. | Accepted and named in the CHANGELOG; the agent-ready test narrows it. |
| F2 | Suggestion | The sitemap regex reads `<loc>` without a namespace prefix only. | Accepted: sitemaps.org uses the default namespace. |
