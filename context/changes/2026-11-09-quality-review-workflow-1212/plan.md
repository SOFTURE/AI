---
change_id: quality-review-workflow-1212
status: in_progress
---

# Plan: quality review workflow (issue #1212)

Input: change.md, research.md. Complexity: medium.

## Phase 1: package `tools/quality-review`

- `@softure-ai/quality-review` 0.1.0, bin `softure-quality-review` (`run`, `check`).
- `findings.ts`: the finding schema (zod) the agent emits as `<finding>{json}</finding>` blocks in its messages; rules
  per category; stable id `QR-<8 hex>` from rule, file and symbol (not the line, which moves).
- `verify.ts`: drops a finding whose file is outside the repository, missing, or shorter than its line.
- `ignore.ts`: `quality-review.ignore` and the `## Quality review exceptions` section of `AGENTS.md`: ids, `rule
  <rule> [<glob>]`, `path <glob>`.
- `report.ts`: render and parse/validate `QUALITY-REPORT.md` (format 1): header table (date, commit, model, cost
  and budget, tokens, status, counts), critical and warning findings in full, suggestions grouped in a table.
- `agent.ts`: the read-only options (tools, guards, no settings, no MCP, budget, turns), and `runReview` with an
  injected `query`; the real one is imported at run time from `@anthropic-ai/claude-agent-sdk`, an optional peer the
  workflow installs, so the monorepo never installs the 340 MB binary.
- `prompt/quality-review.md`: the shared prompt (reads `AGENTS.md` first, categories, verify, emit format).

## Phase 2: workflow, example, docs

- `.github/workflows/quality-review.yml`: `workflow_call` only; job `review` (contents read, the API key, no write
  token) runs the CLI and uploads the report; job `deliver` (contents and pull-requests write, no API key) commits it
  on branch `quality-review` from the main branch head and opens or updates one pull request.
- `tools/quality-review/examples/quality-review.yml` (workflow_dispatch caller), README (adoption, secret, run, cost,
  triage by a session, format), CHANGELOG, root README layout, release-tags count.

## Phase 3: tests

- Report format round trip and validator errors; a new run replaces the previous report; ignore file and AGENTS.md
  section; budget stop keeps the verified findings and says so; the tool list stays exactly read-only and every
  guard denies other tools; the workflow's shape (triggers, permissions per job, no schedule, no push to the main
  branch, secret only in `review`, CLI version default equals the package version).

## Acceptance

- Gates: typecheck, lint, test, build. No test calls the API.

## Decisions (auto)

- A package of its own rather than a script in the workflow: the workflow pins a released CLI like the deploy
  workflows do, and a session can run `softure-quality-review check` on a report.
- Findings stream as tagged JSON in the agent's text, not through a tool: the tool list stays exactly
  `Read`/`Glob`/`Grep`, and findings already emitted survive a budget stop.
- The Agent SDK is an optional peer, installed by the workflow at a pinned version (input `agent-sdk-version`).
- Default model `claude-opus-5-5` (the current default model, 4/20 USD per MTok); an input changes it.
- Two jobs, so the API key and the write token never share a job.
- A failed run (no result, an API error) fails the workflow and opens no pull request; a budget stop delivers the
  partial report marked as such.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
