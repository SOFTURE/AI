# @softure-ai/quality-review

A whole-repository quality review on demand. An app starts it by hand; a read-only agent on the Claude Agent SDK
reviews the whole repository against the app's `AGENTS.md`, verifies every finding in the code, and the result,
`QUALITY-REPORT.md`, arrives as one pull request. Reviews of single changes miss what builds up across changes
(authorization gaps, secrets in logs, logic without tests, dead code, drift from `AGENTS.md`); this review looks at
everything at once, for a fixed price cap.

- **Read-only agent.** `Read`, `Glob` and `Grep`, limited to the checkout. No edits, no shell, no network, no MCP
  servers, none of the repository's `.claude` settings or hooks. Three guards enforce it: the tool list, the
  permission callback and a `PreToolUse` hook that refuses any other tool and any path outside the repository. The
  job holds the API key and nothing else: no production secret, no write token.
- **One standard.** The prompt lives in this package (`prompt/quality-review.md`), so every app is reviewed the same
  way and improves in one place. The app's own `AGENTS.md` is read first and wins where it is more specific.
- **On demand, always full.** No schedule, no incremental mode. Every run reviews the whole repository at the commit
  it starts on and replaces `QUALITY-REPORT.md` entirely; the previous report is deleted before the agent starts.
- **Hard cost cap.** `max-budget-usd` (default 10 USD). The real cost, the model and the token counts are in the
  report header.
- **Billed as API usage.** It runs on `@anthropic-ai/claude-agent-sdk` with `ANTHROPIC_API_KEY`, not on
  `claude-code-action`.

## Adoption

1. Copy [`examples/quality-review.yml`](examples/quality-review.yml) to `.github/workflows/quality-review.yml` in the
   app.
2. Add the repository secret `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions → New repository
   secret). A repository secret, not an Environment secret: the review job has no Environment, so no production
   secret can reach it.
3. Allow the workflow to open pull requests: Settings → Actions → General → Workflow permissions → "Allow GitHub
   Actions to create and approve pull requests".
4. Start a run: Actions → quality-review → Run workflow (or `gh workflow run quality-review.yml`). Pick the branch to
   review; the pull request goes into the default branch (input `base-branch` for another).

The caller grants `contents: write` and `pull-requests: write`. The `review` job uses only `contents: read`; the
`deliver` job, which has no API key, commits the report and opens the pull request.

### Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `runs-on` | `'"ubuntu-latest"'` | The runner as JSON, one label or an array (a managed runner: `'["self-hosted","linux"]'`) |
| `model` | `claude-opus-5-5` | The agent's model |
| `max-budget-usd` | `"10"` | Hard cost cap of one run in USD |
| `report-path` | `QUALITY-REPORT.md` | Where the report goes |
| `branch` | `quality-review` | The report branch; cut fresh from the base branch and replaced on every run |
| `base-branch` | the default branch | Where the pull request goes |
| `cli-version` | the released version | `@softure-ai/quality-review` version |
| `agent-sdk-version` | `0.3.319` | `@anthropic-ai/claude-agent-sdk` version |
| `node-version` | `"22"` | Node.js version |

Secret: `ANTHROPIC_API_KEY` (required).

## Cost expectations

The cap is hard: the SDK stops the agent once the run's cost passes `max-budget-usd` (it can overshoot by the one
model call in flight). With the default model (`claude-opus-5-5`, 4 USD per million input tokens, 20 USD per million
output tokens, cache reads 0.20 USD) a small app (tens of source files) usually finishes well under the cap; a large
monorepo may reach it. A run that reaches the cap still delivers the findings it verified before the stop, and the
report says "stopped at the budget": the areas it did not reach are not proven clean. The agent works through the
areas in order of risk (security first, dead code last), so a stopped run has covered the most serious ones. Raise
the cap, or pass `model: claude-sonnet-5-5` (2 / 10 USD per million tokens), for a larger repository.

## Report format

`QUALITY-REPORT.md`, format 1 (the marker `<!-- softure-quality-review format 1 -->` is in every report):

- **Header table:** `Date` (UTC, ISO 8601), `Commit` (the reviewed commit), `Model` (the models that ran, the most
  expensive first), `Cost` (`<real> USD of a <cap> USD budget`), `Tokens` (`input`, `output`, `cache read`,
  `cache write`), `Status` (`complete`, `stopped at the budget` or `stopped at the turn limit`), `Findings` (count per
  severity), `Ignored` (findings an accepted exception covered).
- **`## Critical` and `## Warnings`:** one block per finding:

  ```markdown
  ### QR-1a2b3c4d: deleteProject deletes any project without an ownership check

  - Severity: critical
  - Category: security
  - Rule: missing-authorization
  - Location: `src/app/projects/actions.ts:42`
  - Symbol: `deleteProject`
  - Problem: …
  - Impact: …
  - Fix: …
  ```

- **`## Suggestions`:** the minor items, grouped at the end in one table with the same fields
  (`| ID | Category | Rule | Location | Symbol | Title | Problem | Impact | Fix |`).
- A section with nothing in it says `None.`; a complete run with no findings says so above the sections.

The **id** is `QR-` and 8 hex digits of the SHA-256 of the rule, the file and the symbol, not the line, so the same
problem keeps its id from run to run while the code around it moves. Categories and rules:

| Category | Rules |
| --- | --- |
| `security` | `missing-authorization`, `secret-in-log`, `unprotected-public-endpoint`, `unsafe-sql`, `other-security` |
| `errors` | `swallowed-error`, `missing-timeout`, `other-error-handling` |
| `tests` | `untested-logic`, `empty-test` |
| `dead-code` | `unused-file`, `unused-export`, `unused-dependency` |
| `conventions` | `agents-md-violation`, `local-workaround` |

`npx @softure-ai/quality-review check [QUALITY-REPORT.md]` validates a report (marker, header, every field, each id
recomputed, sections and counts); `parseReport` does the same in code and returns the findings.

## Accepted exceptions

`quality-review.ignore` at the repository root, or a list under `## Quality review exceptions` in `AGENTS.md`. One
entry per line, `#` starts a comment, a Markdown bullet and backticks are allowed:

```text
QR-1a2b3c4d                      # one finding, by id
rule unused-export src/sdk/**    # a rule under a path glob
rule empty-test                  # a rule everywhere
path legacy/**                   # everything under a path glob
```

Globs: `**` any folders, `*` within one segment, `?` one character. Covered findings are counted in the header
(`Ignored`) and not listed. A line in none of the forms is reported in the run's log and ignored.

## Triage the report

A session that receives the report's pull request:

1. Runs `npx @softure-ai/quality-review check QUALITY-REPORT.md` (or `parseReport`) and works from the parsed
   findings, not from prose.
2. Takes the findings in order: critical, warnings, suggestions. For each one, opens `file:line` and confirms the
   problem still holds at the current head (the report is a snapshot of its commit).
3. Decides per finding: a fix becomes an issue or a roadmap item in the app's own chain, titled with the finding's
   title and carrying its id (`QR-…`) so the next report can be matched against it; a false positive or a conscious
   choice becomes a line in `quality-review.ignore` with a comment saying why; related findings (one rule across many
   files) may share one item.
4. Merges the report's pull request (with the ignore file changes, if any) once every finding is turned into work or
   accepted. The next run replaces the report entirely; a finding that is fixed simply no longer appears.

## How it works

`softure-quality-review run [--repo .] [--out QUALITY-REPORT.md] [--model …] [--max-budget-usd 10] [--max-turns 400]
[--commit <sha>]`:

1. Deletes the previous report, reads the accepted exceptions.
2. Starts the agent (`query` of `@anthropic-ai/claude-agent-sdk`, an optional peer the workflow installs next to this
   package) with the shared prompt and the read-only options (`buildAgentOptions`).
3. Collects each `<finding>{json}</finding>` the agent emits as soon as it has verified it, so a stop at the budget
   keeps what came before; a block that does not match the schema is dropped and logged.
4. Drops a finding whose file is outside the repository, missing, or shorter than its line; removes duplicates and
   the findings an exception covers.
5. Writes the report. A run that fails (an API error, no result) writes nothing and exits 1, so the workflow opens no
   pull request.

The library exports the same pieces: `runReview`, `buildAgentOptions`, `getToolRefusal`, `extractFindings`,
`getFindingId`, `verifyLocations`, `readIgnoreRules`, `applyIgnoreRules`, `renderReport`, `parseReport`.
