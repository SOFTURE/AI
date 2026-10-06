# Research: deploy-release-report

## 1. FIRE_TRACKER's living report (read only, `ced4e2d`)

- `src/lib/release-notes.ts`: three sections between `<!-- release:<key> -->` markers (`overview`, `status`,
  `deployments`), always in that order; a section is replaced in place, a missing one is inserted before the first
  later section or appended. `renderStatus` writes `| Stage | Result |` with an icon per result
  (`success`, `failure`, `cancelled`, `skipped`, anything else `pending`) and `Last run: [<time>](<run url>)`.
  `appendDeployment` keeps the earlier rows of the section and puts the new row on top (newest first), columns
  `When | Result | Environment | Image | Database | Verification | Run`; Database joins migrations, backup and
  `rows before → after` with `<br>`.
- `parseGatewayOutput` reads `kopia|<path>|<bytes>`, `liczniki|przed|…`, `liczniki|po|…` and the detail of
  `krok|schemat|ok|…` from the server's output.
- `release.yml`: the deploy job greps `^(krok|liczniki|kopia|wynik)\|` from the ssh output into an artifact
  (`gateway-output`, `if: always()`); a final `report` job (`if: always() && needs.prepare.result == 'success'`,
  `contents: write`) downloads it, reads the body with `gh release view`, writes status then deployment and runs
  `gh release edit --notes-file`. No release for the tag: a notice and exit 0. Times are Europe/Warsaw.

Generic: the section rules, the status table, the newest-first history, the artifact hand-off and the "no release,
no report" exit. FIRE-specific: Warsaw time (a shared package writes UTC and says so), the fixed URLs and
environment name, the `overview` section (DF-1 has `release-notes` for that), migration counts (`schema-guard` prints
them but DF-9's `step|schema|ok` carries no detail; left out, see §4).

## 2. Release body or Deployments API (the roadmap's unknown)

The release body. The Deployments API needs `deployments: write`, is shown on the repository's environment page, not
on the release the owner reads, and holds a status per deployment, not a table with backup and row counts. FIRE uses
the body and the owner reads it there (AGENTS.md: "Opis release'u = tabela roadmapy"). The body also keeps working
when the caller passes no `environment`.

## 3. Permissions of a reusable workflow

A called workflow's jobs can only narrow what the calling job grants: a nested job asking `contents: write` under a
caller that grants `contents: read` fails the whole run at startup ("is requesting 'contents: write', but is only
allowed 'contents: read'"). The example caller grants `contents: read` and `packages: write`, and the repository test
pins that ("nothing to write code"). A report job inside `deploy-app.yml` would force every caller to grant
`contents: write` to the build, deploy and verify jobs as well.

So the report is a second reusable workflow, `deploy-report.yml`, called by its own job in the caller with
`contents: write` on that job only. `deploy-app.yml` hands it the facts through an artifact of the same run (a called
workflow's artifacts belong to the caller's run): a `summary` job (`if: always()`, no permissions) uploads
`deploy-report.json` with each job's result, the image, the digest and the server's `step|`/`result|` lines.
`upload-artifact` refuses a second artifact of the same name in one run unless `overwrite: true`; a re-run of the
failed jobs uploads again, so the summary uploads with `overwrite: true`.

## 4. What DF-9's server lines carry (PR #132, `689b160`)

`deploy.sh` prints `step|<name>|ok[|<detail>]` per step and ends with `result|ok` or
`result|failed|<step>|<message>`; the send step tees the ssh output to `$RUNNER_TEMP/deploy-output.txt` and fails
without `result|ok`. Details today: `row-counts-before` says `skipped` when nothing is counted, `images` (maintain)
says `removed <n>`; `backup`, `row-counts-before` and `row-counts-after` say nothing. The CLI prints
`backup: wrote <path> (<bytes> bytes)…` and writes counts as JSON (`--out`, `{ takenAt, counts }`); `row-counts
--compare` also takes `--out`. So `deploy.sh` can put the backup's file name and both counts on its step lines
without new CLI output: `step|backup|ok|<file name>`, `step|row-counts-before|ok|users=3,billing.plans=2`,
`step|row-counts-after|ok|users=3,billing.plans=2`. Table names are SQL identifiers, optionally schema-qualified
(`parseTableList`), so `,` and `=` never occur in them.

## 5. The CLI side

`release-notes --body` (DF-1) owns one section (`<!-- softure-deploy:release-notes -->`), written by
`writeReleaseSection`. The report needs two more sections with the same rules: `status` (replaced) and `deployments`
(a row prepended). `release-body.ts` generalises to a section key; the existing exports stay for `release-notes`.
Section order is fixed (release-notes, status, deployments), as in FIRE, so the body reads the same on every release.
The copy (headings, column titles, result words) goes into the `en`/`pl` dictionaries like the release notes'.

## 6. Testing without a live release

- The CLI: unit tests on the section rules, the status table, the row and the parsing of the summary file (zod).
- The workflows: actionlint and the repository test (permissions, no interpolation, the caller's two jobs).
- End to end: `e2e-deploy.yml` calls `deploy-report.yml` with `e2e: true` (refused outside SOFTURE/AI, like
  `deploy-app.yml`'s): the CLI from the tag, a fixture body instead of `gh release view`, the result uploaded as an
  artifact instead of `gh release edit`; the `assert` job checks the status table and the row. The recording server
  of DF-3 prints the `step|`/`result|` lines DF-9 requires (DF-9 brings that when it takes `master`).
