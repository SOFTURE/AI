---
change_id: ops-build-info-878
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and master (90e8bad).

- Plan coverage: all four phases are in. ops: `readBuildInfo`, `createBuildInfoResponse`, `createBuildInfoRoute`,
  `withBuildInfo` (new export `./next-config`), `BuildInfo`. deploy: `smoke` and `changelog` commands, the action's
  smoke step with its summary line, `sent-at`, `deployed-at`, `build-info-path` and `build-info-headers`,
  `deploy-app.yml`'s `build-info-path`, the `SOFTURE_BUILD_COMMIT` build argument on both build paths, init's compose
  and Dockerfile lines, the regenerated e2e app, the example app's route, spec and `e2e-deploy.yml` wiring.
- Opt-in holds: every new input defaults to empty; the report's verify result only adds `steps.smoke.outcome !=
  'failure'`, which is true when the step is skipped.
- Secrets: headers reach the CLI through a 0600 file, every value masked first, bad lines named by number; the CLI
  never prints a header. The route answers only build facts.
- Shell: the smoke step uses bash 3.2 constructs only (indexed arrays, `[[ =~ ]]`), `date -u +%Y-%m-%dT%H:%M:%SZ` works
  with BSD and GNU date.
- Tests: unit tests for both packages (checks, CLI, changelog, route, helper), repository tests for the wiring and a
  bash run of the smoke step with a stub `npx` (passed, failed, no deploy time, headers, bad path), the send step's
  `sent-at`. The example app's e2e spec and e2e-deploy measure the inlining and the whole smoke on a real stack.
- Out of scope as briefed: MCP `get_server_info` (after #877).

Verdict: approved.
