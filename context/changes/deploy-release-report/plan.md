# Plan: deploy-release-report

Input: change.md, research.md. Complexity: medium (a CLI command with two body sections, a summary job and a second
reusable workflow, step details in the server script, the example and e2e callers, tests, README).

## Goal

After a deploy run, the GitHub Release of the tag carries a `Pipeline status` section (replaced by every run) and a
`Deployments` section (one row per run prepended, earlier rows kept), next to the owner's text and the
`release-notes` section, which stay untouched.

**Out of scope:** the `release-notes` section itself (DF-1; whoever cuts the release writes it, DF-12); migration
counts in the row (no step line carries them); Europe/Warsaw time (a shared package writes UTC); the GitHub
Deployments API (research §2).

## Approach

**Chosen:** `deploy-app.yml` collects, a separate reusable `deploy-report.yml` writes.

1. **Server lines (after DF-9 is on `master`).** `init`'s `deploy.sh` adds details: `step|backup|ok|<file name>`
   (parsed from the CLI's `backup: wrote <path> (<n> bytes)` line, file name only), `step|row-counts-before|ok|<t>=<n>,…`
   and `step|row-counts-after|ok|<t>=<n>,…` (formatted from the `--out` JSON files; the compare call gets
   `--out=$work/counts-after.json`). `maintain`'s backup line gets the same detail. The committed e2e copy is
   regenerated (`npm run e2e-app -w @softure-ai/deploy`).
2. **`deploy-app.yml` (after DF-9).** The deploy job keeps the `^(step|result)\|` lines of the server output as a job
   output `server-lines` (an `if: always()` step after the send; the heredoc delimiter cannot occur because every
   kept line starts with `step|` or `result|`; `2> /dev/null || true` when the send never ran, P2); the cleanup
   removes the output file. A new `summary` job
   (`needs: [check, build, deploy, verify]`, `if: always()`, `permissions: {}`) writes `deploy-report.json` with `jq`
   (`version: 1`, tag, environment, image, digest, run URL with the attempt, `finishedAt` in UTC, the four jobs'
   results in order, the server lines) and uploads it as the artifact `deploy-report` (`overwrite: true`, so a
   re-run of failed jobs replaces it).
3. **`deploy-report.yml` (new, `workflow_call`).** Inputs: `tag` (required), `locale` (`en`), `deploy-cli-version`
   (the package version), `node-version`, `e2e` (refused outside SOFTURE/AI). One job `report`,
   `permissions: contents: write`, `continue-on-error: ${{ !inputs.e2e }}` (a failed report never turns a production
   run red; the e2e must), `concurrency: deploy-report-<repo>-<tag>` without cancelling, so two runs on one tag never
   overwrite each other's row (under e2e `-e2e-<run id>` is appended, plan review P1). The two `gh` steps alone get
   `GH_TOKEN` and pass `--repo` (P4). Steps: validate inputs; download `deploy-report`; set up Node; (e2e) build the CLI from
   the tag; read the body with `gh release view --repo` (no release: a notice, nothing written) or, on e2e, a fixture
   body; `softure-deploy release-report --body --summary --locale --out`; `gh release edit --notes-file` (not on
   e2e); (e2e) upload the new body as `deploy-report-body`.
4. **CLI `softure-deploy release-report --body=<file> --summary=<deploy-report.json> [--locale=en|pl] [--out=<file>]`.**
   The summary is parsed with zod (strict, `version: 1`). `release-body.ts` generalises to a section key
   (`release-notes`, `status`, `deployments`; markers `<!-- softure-deploy:<key> -->`), in that fixed order: a
   missing section goes before the first later one present, else at the end; the old exports keep their behaviour.
   `status`: `| Job | Result |` with an icon per result (`success` ✅, `failure` ❌, `cancelled` ⛔, `skipped` ⏭️,
   anything else ⏳ `pending`) and `Run: [<time> UTC](<run url>)`. `deployments`: written only when the deploy job
   was not `skipped`; columns `When (UTC) | Result | Environment | Image | Database | Verify | Run`; the new row on
   top of the earlier rows of the section (table rows after its separator). Result: `deployed` on success,
   `failed at <step>` from `result|failed|<step>|…` (else `failed`), or the job's own result. Database: `backup:
   <file>` and `rows: users 3 → 4, …` (or `rows: not counted`; a table with no count after shows `3 → ?`, P3), `—` with neither. Every value from the summary is
   reduced to a safe character set before it enters a table cell (no `|`, `<`, backtick or newline). Copy in
   `messages/en.ts` and `pl.ts`.
5. **Callers.** `tools/deploy/examples/deploy.yml` gains a `report` job (`needs: deploy`, `if: always()`,
   `permissions: contents: write` on that job only, same tag expression). `e2e-deploy.yml` gains a `report` job
   with `e2e: true`, and its `assert` job also checks the body with `tools/deploy/e2e/check-report.sh` (the owner's
   fixture text kept, both sections present, a status row per job, a row with the image and `deployed`).

**Rejected:** a report job inside `deploy-app.yml` (every caller would have to grant `contents: write` to all jobs,
research §3); passing results as outputs of the called workflow (a failed called workflow's outputs are not a
contract to rely on, and the caller sees one result for the whole call); a separate `--status`/`--deployment`
mode of `release-notes` (one command per writer is simpler for the workflow and keeps `release-notes`' git logic
apart); the Deployments API (research §2).

## Phase 1: the CLI command

**Discipline:** test-first.
**Files:** `tools/deploy/src/notes/release-body.ts` (+ test), `tools/deploy/src/notes/release-report.ts` (+ test),
`tools/deploy/src/cli/release-report-command.ts`, `tools/deploy/src/cli/run.ts`, `tools/deploy/src/messages/en.ts`,
`pl.ts`, `tools/deploy/src/index.ts` (exports), `tools/deploy/README.md`.

1. Tests: sections keep their fixed order whatever order they are written in; the old `release-notes` behaviour is
   unchanged (existing tests stay green); status table for four jobs with an unknown result shown as pending; a
   first deployment into an empty body; a second run prepends and keeps the first row byte for byte; a failed run
   names the step; a skipped deploy writes status only; row counts and backup parsed from server lines, absent ones
   shown as `—`/`not counted`; a value with `|`, `<` or a newline cannot break the table; a summary that is not
   version 1 or misses a field fails with the field's name; the CLI writes `--out` and prints to stdout without it.
2. Implementation as above.

## Phase 2: the workflows and the server lines (after DF-9 is on `master`)

**Discipline:** test-first for the repository test and `server-files.test.ts`; the composed run is verified by
`e2e-deploy` on the pull request.
**Files:** `tools/deploy/templates/docker/server/deploy.sh.tmpl`, `tools/deploy/tests/server-files.test.ts`,
`tools/deploy/e2e/app/**` (regenerated), `tools/deploy/e2e/check-report.sh` (+ test in `e2e-scripts.test.ts`),
`.github/workflows/deploy-app.yml`, `.github/workflows/deploy-report.yml`, `.github/workflows/e2e-deploy.yml`,
`tools/deploy/examples/deploy.yml`, `tests/repo/deploy-workflows.test.ts`, `tools/deploy/README.md`.

1. Tests: the server script prints the backup file and both counts on its step lines; the deploy job exposes
   `server-lines`; `summary` runs always with no permissions and uploads with `overwrite: true`; `deploy-report.yml`
   is `workflow_call` only, `contents: write` on its one job, continues on error except under e2e, refuses e2e outside
   SOFTURE/AI, never interpolates inputs into scripts and edits the release only off e2e; the example caller grants
   `contents: write` to the report job only; no job but `build` has `packages: write` (P5); the e2e caller's report
   job and assert step match.
2. Implementation as above.
3. Gates: typecheck, lint, test, build; actionlint with shellcheck over the workflows; the summary job's `jq` and the
   check script run locally; `e2e-deploy` green on the pull request.

## Progress

#### Automated
- [ ] Phase 1: the CLI command
- [ ] Phase 2: the workflows and the server lines

#### Manual
- [ ] The `e2e-deploy` run on the pull request is green (CI, before merge)
