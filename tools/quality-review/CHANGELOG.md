# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/quality-review` or the reusable
`quality-review.yml` workflow. When an app has run a version in production, the version gets a line
`verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md), "Definition of done").

## 0.3.0

- `focus: security` proves its coverage (#1325). The agent emits a `<coverage>` block per threat scenario (`traced`
  with the files it read, or `no-surface` with what it searched); the program keeps only files the agent really read
  and counts the files read and the turns. A run that ends with scenarios unaccounted for gets up to two follow-up
  turns in the same session (one `query()` call with a streamed prompt, so the one cost cap still holds); what is
  still missing is reported as `not covered`.
- The security report gains `Turns` and `Files read` header rows and a `## Coverage` section before the findings;
  `check` validates it. A report with a coverage section needs this version's `check` (the workflow runs one CLI
  version for both).
- A tenth scenario, runtime and deployment hardening, with the new rule `runtime-hardening` (container
  capabilities, privilege escalation, published ports, pinned images, CI token scope, a response plan for a
  compromised host or a leaked secret).
- A general run is unchanged: same prompt, task, string prompt and report.
- Report branches that coexist (#1324): the default branch is `quality-review-<focus>` (`quality-review-general`,
  `quality-review-security`), plus `--<scope-slug>` for a scope. The 0.2.0 names nested (`quality-review`,
  `quality-review/security`, `quality-review/security/<slug>`), and git cannot hold a branch next to one below it, so
  a run failed to push once a branch above or below its own existed. The new names hold no `/` and nest under none
  of the old ones. CLI `resolve` prints the name as `report-branch=`; the workflow falls back to the 0.2.0 names with
  an older `cli-version`.
- Adoption: a general whole-repository run now delivers on `quality-review-general` instead of `quality-review`. The
  branches and pull requests 0.2.0 opened (`quality-review`, `quality-review/...`) are no longer updated: close them
  and delete the branches once their report is read. An explicit `branch` input works as before.

## 0.2.0

- `focus` (#1289): `general` (default, unchanged) or `security`, a second shipped prompt
  (`prompt/security-review.md`) that traces threat scenarios end to end (sign-in and sessions, OAuth 2.1, MCP and API
  token scope, inbound webhooks, command execution and SSH, SSRF, CSRF, rate limits, secrets) and names the attack
  path of each finding. New `security` rules: `auth-session`, `oauth-flow`, `token-scope`, `webhook-verification`,
  `command-injection`, `ssrf`, `csrf`, `rate-limit`.
- `scope`: one folder or workspace package by name. Findings only inside it, its local context (`AGENTS.md` on the
  path, `README.md`, `package.json`, `CHANGELOG.md`, tests) leads the task, the report goes to
  `<scope>/QUALITY-REPORT.md`, and `<scope>/quality-review.ignore` holds its own exceptions. An unknown scope fails
  before any model call.
- `paths`: globs; findings outside them are dropped.
- The report header gains `Focus`, `Scope` and `Paths` when set; `check` accepts both kinds. A general
  whole-repository run keeps its prompt, task and report exactly.
- CLI `resolve` prints the report path and branch suffix. The reusable workflow takes `focus`, `scope` and `paths`;
  `report-path` and `branch` default to empty and resolve per focus and scope (`quality-review/security`,
  `quality-review/<scope-slug>`), so several runs can be open at once. New example
  `examples/quality-review-matrix.yml`.
- Adoption: nothing to change; pass the new inputs to use them.

## 0.1.1

- The reusable workflow installs this version by default (`cli-version`). The first release published through the
  npm trusted publisher (OIDC, with provenance); no change in behaviour.

## 0.1.0

- First version (#1212): a whole-repository quality review on demand. The reusable workflow
  `.github/workflows/quality-review.yml` runs `softure-quality-review run`, a read-only agent on the Claude Agent SDK
  (`Read`, `Glob`, `Grep` inside the checkout; no edits, shell, network, MCP servers or the repository's `.claude`
  settings) that reviews the repository against its `AGENTS.md` (security, error handling, tests, dead code,
  conventions and local workarounds), verifies every finding in the code and stops at a hard cost cap (default
  10 USD). The result is `QUALITY-REPORT.md` in a fixed format (stable ids, severity, `file:line`, problem, impact,
  fix; minor items grouped at the end; cost, model and tokens in the header), delivered as one pull request from the
  branch `quality-review`. Accepted exceptions live in `quality-review.ignore` or under `## Quality review exceptions`
  in `AGENTS.md`. `softure-quality-review check` validates a report.
- Adoption for an app: copy `examples/quality-review.yml`, add the repository secret `ANTHROPIC_API_KEY`, allow
  GitHub Actions to create pull requests, start it under Actions (README, "Adoption").
