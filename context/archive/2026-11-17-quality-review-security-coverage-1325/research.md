# Research: security coverage evidence (issue #1325)

## Current package (0.2.0)

- `review.ts` `runReview` calls `query({ prompt: task, options })` once with a string prompt, reads `<finding>`
  blocks from assistant text and the last `result` message (`subtype`, `total_cost_usd`, `modelUsage`). It ignores
  tool-use blocks and `num_turns`, so nothing records what the agent read.
- `prompt/security-review.md` lists nine scenarios (sign-in, OAuth, token scope, webhooks, command execution,
  outbound requests, CSRF, rate limits, secrets) and ends with `Review complete: <n> findings.` Nothing makes the agent
  account for each scenario; it may end after a quick map of the surface.
- `report.ts`: optional header rows are read by name (`Focus`, `Scope`, `Paths`), so `Turns` and `Files read` can be
  added for focused runs without a format bump. `parseReport` refuses an unknown `## ` section, so a `## Coverage`
  section must be taught to the parser (the workflow runs `check` with the same CLI version that wrote the report).
- `findings.ts` `CATEGORY_RULES.security`: adding a rule leaves every existing id unchanged (the id hashes the rule,
  file and symbol).

## Agent SDK (0.3.326, the peer range is `>=0.3.319`)

- `query({ prompt: string | AsyncIterable<SDKUserMessage> })`. In streaming-input mode one `query()` call holds
  several turns; each turn ends with a `result` message and `total_cost_usd` is cumulative for the call ("read the
  latest result rather than summing across results"), and `maxBudgetUsd` covers the whole call. So a follow-up turn
  stays inside the one budget, and the latest result carries the totals.
- `resume` with a second `query()` would restart `maxBudgetUsd` and may carry the saved total in the first result:
  rejected, it breaks the single hard cap.
- `SDKUserMessage`: `{ type: "user", message: { role: "user", content }, parent_tool_use_id: null }`.
- Result messages carry `num_turns`; assistant messages carry `tool_use` blocks (`name`, `input.file_path` for Read).
- The output iteration ends only after the input stream ends, so the run must close the input after the last turn,
  also on an error.

## The adopting app's gaps

The manual review found container hardening gaps (default Linux capabilities, setuid escalation) and a missing
compromised-host runbook. None of the nine scenarios covers runtime or deployment configuration: a tenth scenario
(`runtime-hardening`) does.

## Decisions (auto)

- Coverage is reported by the agent and checked by the program: a `traced` entry keeps only files the agent read in
  this run; one with none left counts as not covered.
- At most two follow-up turns; what is still missing afterwards is reported as `not covered`, with a note above the
  findings that the area is not proven clean.
- Only the security focus gets coverage, the follow-up and the new header rows; the general run is unchanged.
