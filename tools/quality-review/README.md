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
- **On demand, always full.** No schedule, no incremental mode. Every run reviews the whole repository (or the one
  scope it is given) at the commit it starts on and replaces its report entirely; the previous report is deleted
  before the agent starts.
- **Breadth or depth.** The default `general` review covers five categories at once. `focus: security` runs a second
  shipped prompt that traces threat scenarios end to end (sign-in, OAuth, tokens, webhooks, command execution,
  outbound requests), and `scope` gives the whole budget to one folder or workspace package ("Focus, scope and
  paths").
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
| `focus` | `general` | `general` (the breadth review) or `security` (threat scenarios traced end to end) |
| `scope` | empty (whole repository) | One folder (`modules/auth`) or workspace package (`@acme/auth`) to review |
| `paths` | empty (all findings) | Globs, comma or space separated; findings outside them are dropped |
| `report-path` | `QUALITY-REPORT.md`, or `<scope>/QUALITY-REPORT.md` with a scope | Where the report goes |
| `branch` | `quality-review`, plus `/security` and `/<scope-slug>` when set | The report branch; cut fresh from the base branch and replaced on every run |
| `base-branch` | the default branch | Where the pull request goes |
| `cli-version` | the released version | `@softure-ai/quality-review` version |
| `agent-sdk-version` | `0.3.319` | `@anthropic-ai/claude-agent-sdk` version |
| `node-version` | `"22"` | Node.js version |

Secret: `ANTHROPIC_API_KEY` (required).

## Focus, scope and paths

Three inputs narrow or deepen a run; without them the review, its prompt and its report are exactly the
whole-repository breadth review.

- **`focus: security`** (CLI `--focus security`) swaps the prompt for
  [`prompt/security-review.md`](prompt/security-review.md). Instead of scanning for patterns it works through threat
  scenarios, each where the repository has the surface, and traces every flow from the untrusted input to its effect:
  sign-in and sessions, OAuth 2.1 and the authorization server, MCP and API token scope, inbound webhooks, command
  execution and SSH, outbound requests (SSRF), CSRF, rate limits, secrets and personal data. A finding names the
  attack path (input → steps → effect) in `problem` and the concrete change in `fix`. Its rules are the eight security rules
  plus the five general security rules. The report is titled "Security report" and its header has `Focus`.
- **`scope`** (CLI `--scope`) reviews one folder (`--scope modules/mcp-access`) or a workspace package by name
  (`--scope @softure-ai/mcp-access`, resolved through the root `package.json` `workspaces`). The agent may read the
  whole repository to follow an import, a caller or a shared helper, but only findings inside the scope are
  reported. The task starts with the scope's local context: the `AGENTS.md` files on the path from the root to the
  scope, its `README.md`, `package.json` and `CHANGELOG.md` (each cut at 12,000 characters), and where its tests are;
  `unused-export` and `unused-dependency` are judged against the package's exports and its dependents. The report
  goes to `<scope>/QUALITY-REPORT.md` by default and its header has `Scope`. An unknown package name, a missing
  folder or one outside the repository fails before any model call.
- **`paths`** (CLI `--paths`, repeatable or comma separated) keeps only findings in files that match one of the
  globs, relative to the repository root (`modules/auth/**,src/webhooks/**`). With a scope, a finding must be inside
  both. The header has `Paths`.

Finding ids do not depend on any of them, so the same problem has the same id in a scoped and a whole-repository
run, and in a general and a security report. Both kinds pass `check`.

A security run of the shared modules, then the app's own surfaces:

```yaml
    with:
      focus: security
      scope: modules/mcp-access
      max-budget-usd: "15"
      report-path: modules/mcp-access/SECURITY-REPORT.md
```

```yaml
    with:
      focus: security
      paths: src/app/api/webhooks/**,src/exec/**
      max-budget-usd: "15"
```

[`examples/quality-review.yml`](examples/quality-review.yml) offers `focus`, `scope` and `paths` on the Run workflow
form; [`examples/quality-review-matrix.yml`](examples/quality-review-matrix.yml) reviews a list of packages, one job
and one pull request per package.

## Cost expectations

The cap is hard: the SDK stops the agent once the run's cost passes `max-budget-usd` (it can overshoot by the one
model call in flight). With the default model (`claude-opus-5-5`, 4 USD per million input tokens, 20 USD per million
output tokens, cache reads 0.20 USD) a small app (tens of source files) usually finishes well under the cap; a large
monorepo may reach it. A run that reaches the cap still delivers the findings it verified before the stop, and the
report says "stopped at the budget": the areas it did not reach are not proven clean. The agent works through the
areas in order of risk (security first, dead code last), so a stopped run has covered the most serious ones. Raise
the cap, or pass `model: claude-sonnet-5-5` (2 / 10 USD per million tokens), for a larger repository.

A `focus: security` run follows flows end to end and reads more per finding: use `claude-opus-5-5` and
`max-budget-usd: "15"`, and narrow it with `scope` or `paths` to the code where a mistake costs the most. A scoped
run spends the whole budget on its scope, so one package gets the depth a whole application gets.

## Report format

`QUALITY-REPORT.md`, format 1 (the marker `<!-- softure-quality-review format 1 -->` is in every report):

- **Header table:** `Date` (UTC, ISO 8601), `Commit` (the reviewed commit), `Model` (the models that ran, the most
  expensive first), `Cost` (`<real> USD of a <cap> USD budget`), `Tokens` (`input`, `output`, `cache read`,
  `cache write`), `Status` (`complete`, `stopped at the budget` or `stopped at the turn limit`), `Findings` (count per
  severity), `Ignored` (findings an accepted exception covered). A focused, scoped or path-limited run adds, after
  `Commit`, `Focus` (`security`), `Scope` (`` `modules/auth` (@acme/auth) ``) and `Paths` (`` `a/**`, `b/**` ``); a
  general whole-repository report has none of them.
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
| `security` | `missing-authorization`, `secret-in-log`, `unprotected-public-endpoint`, `unsafe-sql`, `other-security`; with the security focus also `auth-session`, `oauth-flow`, `token-scope`, `webhook-verification`, `command-injection`, `ssrf`, `csrf`, `rate-limit` |
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

A scoped run also reads `<scope>/quality-review.ignore`, that package's own exceptions. Its globs are relative to the
scope folder (`rule unused-export src/legacy/**`), and a `rule` line without a glob covers the scope only.

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
[--commit <sha>] [--focus general|security] [--scope <folder|package>] [--paths <glob>,…]`:

1. Resolves the scope (it fails here, before any model call, when it does not exist), deletes the previous report,
   reads the accepted exceptions.
2. Starts the agent (`query` of `@anthropic-ai/claude-agent-sdk`, an optional peer the workflow installs next to this
   package) with the shared prompt and the read-only options (`buildAgentOptions`).
3. Collects each `<finding>{json}</finding>` the agent emits as soon as it has verified it, so a stop at the budget
   keeps what came before; a block that does not match the schema is dropped and logged.
4. Drops a finding whose file is outside the repository, missing, or shorter than its line, or outside the scope or
   the paths; removes duplicates and the findings an exception covers.
5. Writes the report. A run that fails (an API error, no result) writes nothing and exits 1, so the workflow opens no
   pull request.

`softure-quality-review resolve [--focus …] [--scope …] [--out …]` checks the focus and the scope without a model
call and prints `report-path=`, `branch-suffix=`, `scope-folder=` and `focus=` lines; the reusable workflow writes
them to `GITHUB_OUTPUT`.

The library exports the same pieces: `runReview`, `buildAgentOptions`, `getToolRefusal`, `extractFindings`,
`getFindingId`, `verifyLocations`, `readIgnoreRules`, `readScopeIgnoreRules`, `applyIgnoreRules`, `resolveScope`,
`getScopeContext`, `renderReport`, `parseReport`.
