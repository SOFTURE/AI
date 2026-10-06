# Plan: deploy-fire-parity

Input: change.md, research.md. Complexity: medium (four commands get small options, one README section, five gaps).

## Goal

The generic behaviours of FIRE_TRACKER's release scripts that live in the CLI are in `@softure-ai/deploy` with their
test cases (research §6, "Ported here"); the generic ones in files DF-7 owns are roadmap gaps DF-9…DF-13; the
FIRE-specific ones are listed in the README with the reason.

**Out of scope:** `.github/workflows/deploy-app.yml` and `templates/docker/server/deploy.sh.tmpl` (DF-7 changes them
now); `src/db/row-counts.ts` and the `database` key of `deploy.json` (DF-5); any change in FIRE_TRACKER; a version
bump (0.1.2 is unpublished).

## Approach

**Chosen:** small, opt-in options on the existing commands, each with FIRE's test case translated to the package's
fixtures. Defaults stay as they are, so a `deploy.sh` that `init` generated keeps working unchanged:
- `env render` adds optional names; this is the one default that changes, and it only adds lines for names the
  environment sets (a compose file without `${X:-…}` renders the same file plus the header comment).
- `release-notes --body=<file>` and `--roadmap=<file>`; without them the output is byte-for-byte today's.
- `backup --exclude-table-data=… --max-age-days=N`; the header check always runs (a dump without `PGDMP` is broken).
- `verify` routes take `method`, `body`, `requestHeaders`; defaults `GET`, none, none.

**Rejected:** FIRE's plain SQL + gzip backup format (the custom format is compressed and restores selectively);
FIRE's equality row-count rule (a sign-up during a release is not a failure); a gateway split in this change (DF-7
decides the protocol); a `contentType` route field (a `content-type` header check already does it).

## Phase 1: Optional compose names in `env render`

**Discipline:** test-first.
**Files:** `src/env/required-names.ts` (+ test), `src/env/env-file.ts` (+ test), `src/env/index.ts`,
`src/cli/env-command.ts`, `tests/cli.test.ts`.

1. `findComposeNames(text)` → `{ required: RequiredName[]; optional: string[] }`: optional = `${NAME:-…}` and
   `${NAME-…}`, minus every required name, sorted, once each; `$$` escapes as today. `findRequiredNames` stays (its
   `required` part).
2. `renderEnvFile({ names, optional, env })`: an optional name is written when the environment holds a non-empty
   value, never reported missing; an unsafe optional value is refused by name like a required one. The text starts
   with `# Written by softure-deploy env render from the deploy environment; do not edit on the server.`
3. The CLI prints `wrote N names (M optional)` and lists the written names; values are never printed. "Nothing to
   render" only when the compose file has neither required nor optional names (plan review P2). `tests/cli.test.ts`
   changes on purpose: the stdout line and the header (P1).

**Done when:** tests cover: optional written when set, omitted when unset or empty, required-anywhere wins, bare
`${X}` ignored, unsafe optional refused, header first; `npm test -w @softure-ai/deploy` green.

## Phase 2: Release body sections and the roadmap table in `release-notes`

**Discipline:** test-first.
**Files:** `src/notes/release-body.ts` (new, + test), `src/notes/roadmap-items.ts` (new, + test),
`src/notes/release-notes.ts` (+ test), `src/notes/index.ts`, `src/messages/{en,pl}.ts`,
`src/cli/release-notes-command.ts`, `tests/cli.test.ts`.

1. `writeReleaseSection(body, content)`: the report between `<!-- softure-deploy:release-notes -->` and
   `<!-- /softure-deploy:release-notes -->`; an existing section is replaced in place, text around it kept; a body
   without one gets it appended after a blank line; an empty body gets the section alone. A rewrite replaces from the
   first opening marker to the first closing marker after it (P6). `readReleaseSection` for
   tests and callers.
2. `parseRoadmapItems(markdown)`: rows of the `## At a glance` table only, ID like `AB-12`, bold and backticks
   stripped, status = last cell, `\|` kept inside a cell; `selectShippingItems` = status starting with `done_code`
   (or FIRE's older `done kodowo`).
3. `formatReleaseNotes` takes optional `roadmapItems`: a `### Roadmap items` table (`ID | Change | Outcome`) after the
   summary line, only when at least one item ships.
4. CLI: `--body=<file>` (a missing file is an empty body; the result goes to `--out` or stdout), `--roadmap=<file>`
   (a missing file fails with its path).

**Done when:** FIRE's cases pass in the package's words: owner text kept on a rewrite, one marker pair after two
writes, only At a glance rows, six-column SOFTURE table, `done_code` selected and `done` not; no option = today's
output (the existing tests unchanged).

## Phase 3: Backup exclusions, age limit and integrity

**Discipline:** test-first.
**Files:** `src/db/backup.ts` (+ test), `src/cli/db-commands.ts` (backup only), `tests/db-cli.test.ts`.

1. `--exclude-table-data=a,b.c`: validated with `parseTableList` (the row-count rule for names), passed to `pg_dump`
   as one `--exclude-table-data=<name>` each.
2. `--max-age-days=N` (whole number ≥ 1): after a successful dump, dumps of the prefix whose name stamp is older
   than `now - N days` are removed too; the newest dump is never removed. `parseTableList` is imported from DF-5's
   `row-counts.ts`, never edited (P3).
3. The new file must start with `PGDMP`; otherwise it is removed and the step fails ("not a pg_dump custom-format
   file"), retention not run.

**Done when:** pure tests for the age selection (boundary: exactly N days stays), a fake `pg_dump` script covers the
arguments, a broken header and the removal; existing tests unchanged.

## Phase 4: Request method, body and headers in `verify`

**Discipline:** test-first.
**Files:** `src/verify/schema.ts` (+ test), `src/verify/run-checks.ts` (+ test), `src/verify/report.ts`,
`schema/deploy.schema.json` (regenerated), `tests/verify-cli.test.ts` when the table changes.

1. Route keys: `method` (`GET` default; `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`), `body` (string; refused
   with `GET` or `HEAD`), `requestHeaders` (lower-case names → value; `host`, `content-length`, `connection` and
   `transfer-encoding` refused, P5). A route's headers go on top
   of the defaults.
2. The report's Route column shows `POST /api/mcp` when the method is not `GET`.

**Done when:** a local server sees the method, body and headers; schema tests refuse a body on `GET` and a `host`
header; the JSON Schema is regenerated (`npm run schema -w @softure-ai/deploy` or the package's script).

## Phase 5: README parity section and the gaps

**Discipline:** test-after (repository tests guard links and the roadmap contract).
**Files:** `tools/deploy/README.md`, `context/foundation/roadmap.md`, `context/backlog/roadmap-deploy-followups/`
(README + five entries).

1. README: the new options in each command's section, and "Parity with FIRE_TRACKER": what the package does, what
   DF-9…DF-13 track, what stays in the app and why (research §1–§5); a `POST` route should be a no-op or control
   request (P4).
2. Roadmap: rows and blocks DF-9…DF-13 (`ready` after DF-7, or `blocked`), lanes, and the backlog entries.

**Done when:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

#### Automated
- [x] Phase 1: optional compose names in env render
- [ ] Phase 2: release body sections and the roadmap table
- [ ] Phase 3: backup exclusions, age limit and integrity
- [ ] Phase 4: request method, body and headers in verify
- [ ] Phase 5: README parity section and the gaps

#### Manual
- [ ] Owner: the next release of `@softure-ai/deploy` (0.1.2) carries these options.
