# Implementation review: mcp-access-tool-contract-1078

Verdict: approved.

- Acceptance: both access levels answer the contract equal to `tools/list` in the same factory with strict input on,
  and the version equals the fingerprint of that listing (`server-info-tool-contract-1078.test.ts`).
- `name` narrows to one tool; an unknown name (including a write tool asked for with a read token) answers
  `tools: []` and the caller's `toolNames` only, so nothing beyond the caller's level leaks.
- The answer holds only the build info and what `tools/list` shows the caller; a test checks the user id and token id
  are absent.
- Off by default: the empty input schema, the description and the version are unchanged (existing #885 tests pass).
- With a fixed `version`, the measurement runs only when the contract is read, so a plain factory still measures nothing.
- README states what the app can rely on in the hosted clients section; CHANGELOG under `## Unreleased`.
- Left out on purpose: the issue's optional schema-on-refusal (plan, Decisions).
