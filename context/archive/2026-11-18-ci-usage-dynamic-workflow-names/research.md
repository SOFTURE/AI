# Research: ci-usage-dynamic-workflow-names

- Report #1368: `dynamic/github-code-scanning/codeql` listed as "PR #1240", `dynamic/dependabot/dependabot-updates` as
  "npm_and_yarn in /. - Update #1707303314".
- `tools/ci-usage/src/usage.ts`: the workflow bucket is keyed by `workflowPath` (so minutes are grouped right) but its
  name is the first job's `workflowName`; the longest jobs use each job's own `workflowName`.
- `collect.ts` sets `workflowName` from `job.workflow_name ?? run.name`; for dynamic workflows both carry the run
  title. Cached runs keep that value, so the fix belongs where the report is built, not in the collector.
- Known dynamic paths: `dynamic/github-code-scanning/codeql`, `dynamic/dependabot/dependabot-updates`,
  `dynamic/copilot-swe-agent/copilot`, `dynamic/copilot-pull-request-reviewer/copilot-pull-request-reviewer`,
  `dynamic/pages/pages-build-deployment`.
