# Plan review: deploy-init-release-caller

Reviewed: plan.md against change.md, `tools/deploy/src/init/generate.ts`, `src/cli/run.ts`, the init tests,
`tests/repo/deploy-workflows.test.ts`, `scripts/write-e2e-app.ts`, `scripts/init-image.mjs` and `npm pack
--dry-run`. Verdict: **approve with fixes** (applied to plan.md).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The CLI help (`src/cli/run.ts`) lists what `init` writes ("deploy workflow and deploy.json"); the plan left it out, so `--help` would not name the new file. | Accepted: step 3 also updates the help line. |
| 2 | Suggestion | The plan checks the example and the generated caller are the same YAML, but not that the generated caller passes actionlint in CI; ci.yml lints only the examples. | Accepted as covered: same parsed YAML as a linted example means the same workflow for actionlint (comments aside). Step 5 still runs actionlint locally on a generated file when the binary is reachable. |
| 3 | Check | `templates/.github/` is in the packed tarball (`npm pack --dry-run` lists `templates/.github/workflows/deploy.yml.tmpl`), so the new template ships without a `files` change. | No change. |
| 4 | Check | `write-e2e-app.ts` keeps only the files shipped to the server (`docker/prod/`, `deploy.sh`, `deploy.json`), and `init-image.mjs` checks the compose file, `deploy.sh` and the image; neither lists the workflows. | No change: step 4 confirms `e2e/app/` stays as it is. |
| 5 | Check | Version: `@softure-ai/deploy` is 0.1.3 on master and unreleased (DF-11 waits for it); the roadmap's "each item that changes a published package bumps it" is met by riding 0.1.3. | No change. |
