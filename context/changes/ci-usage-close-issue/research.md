# Research: ci-usage-close-issue

## Findings

- `tools/ci-usage/src/publish.ts` `publishReport`: ensures the label, finds the oldest open issue with the marker
  (`state: open`), creates it or PATCHes its body, then POSTs the totals comment. Returns
  `{ ok, issue, url, created }`.
- Closing as completed is `PATCH /repos/{repo}/issues/{n}` with `{ state: "closed", state_reason: "completed" }`;
  it needs the same `issues: write` the job already has. A comment on a closed issue still notifies subscribers, but
  closing last keeps the order the owner reads (body, comment, closed).
- `src/cli/command.ts` `runPublish` parses `--repository`, `--report-dir`, `--run-url` with `parseArgs`; a boolean
  option fits (`--ubicloud-premium` is the precedent).
- `.github/workflows/ci-usage.yml` step "Publish the issue" runs `publish --report-dir …`; boolean inputs are passed
  as a bash array (the `premium` pattern of the Report step). `tests/repo/ci-usage-workflow.test.ts` pins the inputs,
  the `cli-version` default (= package version) and the self caller.
- SOFTURE/AI's own caller `ci-usage-self.yml`: the owner closes its report issues after reading them (2026-11-18),
  so closing there matches how the repository already works.
- No package depends on `@softure-ai/ci-usage`; npm has 0.1.0 to 0.1.2, so 0.2.0 (new option) is free.
