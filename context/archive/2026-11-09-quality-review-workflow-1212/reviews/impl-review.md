---
change_id: quality-review-workflow-1212
verdict: approved
---

# Implementation review (auto)

- Every deliverable of #1212 is in: reusable workflow, CLI and library, shared prompt, example caller, README
  (adoption, secret, how to run, cost, triage, format), changelog, tests without the API.
- Read-only: the tool list is exactly `Read`/`Glob`/`Grep`; nothing is pre-approved; a permission callback and a
  `PreToolUse` hook refuse any other tool and any path outside the checkout (absolute, `..`, symlink); no settings,
  hooks or MCP servers of the reviewed repository; the agent's environment carries the API key only. Tested.
- Secrets: the API key lives in the `review` job (contents: read, no persisted git credentials); the write token in
  `deliver` (no API key). No Environment is used.
- Replacement: the old report is deleted before the agent starts and the new one is rendered from this run only.
  Tested, including that the file is gone when the agent starts.
- Budget: `maxBudgetUsd` from the input; a budget or turn stop still writes the verified findings marked as stopped;
  a failed run writes nothing and fails the job, so no pull request opens. Tested.
- The SDK option names were checked against `@anthropic-ai/claude-agent-sdk` 0.3.319's types, and a smoke run of the
  built CLI with that SDK and a fake key started the agent and failed cleanly ("Invalid API key", no report).
- Follow-up, not blocking: the report's pull request is opened with `GITHUB_TOKEN`, so the app's own CI does not run
  on it (GitHub's rule); the report is Markdown only, so nothing needs to run. Documented in the README's adoption
  steps through the Actions permission. Approved.
