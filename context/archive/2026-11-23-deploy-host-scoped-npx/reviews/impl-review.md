---
change_id: deploy-host-scoped-npx
verdict: approved
---

# Implementation review

Reviewed the diff against `plan.md` and issue #1436.

- **Acceptance 1:** `npx vitest run tools/host` 57 of 57; the new `server` test and the updated `app add` test failed
  before the change (2 of 13 in `cli.test.ts`). typecheck and lint green in the pre-commit hook.
- **Acceptance 2:** `git grep "npx softure-\(deploy\|host\)"` lists only the deploy README's app-context examples
  (after `npm install --save-dev`, an app's CI steps, its `workflow.json`, its image), which "Running the CLI" now names
  as such, and the in-app `npx softure-deploy init` of host's message and README.
- The printed `app add` command now carries `--inventory`, which the command requires; `--check` prints no next step
  change (same line as before).
- `HostDeps` (public type) is unchanged; the version is read where the message is built.
- Releases: host (patch: printed text) and deploy (README only) ride the next batch; CHANGELOGs carry `## Unreleased`.

Findings: none.
