# Plan: deploy-row-count-new-table

Input: change.md (research and framing skipped, reasons there). Complexity: low (one module, one command, tests,
README, one comment line in `deploy.sh.tmpl`).

## Goal

`row-counts` counts a listed table only when it exists. A table the database lacks is recorded as absent (`null` in
the counts file) and printed as `absent`; that is not an error. With `--compare`, a table absent before and counted
after is new and passes; a table counted before and absent after fails, and so does any table absent after the
deploy. A table missing from the earlier file (not counted at all) still fails, as today.

**Out of scope:** the workflow and the rest of `deploy.sh` (DF-15, DF-10…DF-12 own them); a version bump (0.1.3 is
unpublished and carries DF-7, DF-8, DF-9).

## Approach

**Chosen:**

- Counts file: `counts: Record<string, number | null>`; `null` marks a table the database lacked when counted. A
  file without `null`s (written before this change) still parses. Both server steps run the CLI version the release
  pins, so one deploy never mixes the two formats.
- `countRows` asks `to_regclass($1)` for the quoted name first (the same resolution, through `search_path`, that the
  `count(*)` would use) and counts only a table that exists. It takes a minimal `Queryable` (`query(text, params)` →
  `{ rows }`), which `pg.Client` and PGlite both satisfy, so the test runs on PGlite.
- `compareRowCounts` returns a discriminated union per table: `counted` (before and after, a drop fails), `new`
  (absent before, counted after: passes), `absent` (absent after the deploy: fails, whatever it was before),
  `uncounted` (missing from the earlier file: fails). `lost` keeps its name and meaning: the entries that fail.
- Output: `row-counts: <table> absent` for a plain count; with `--compare`, `<table> new, <n> rows (absent before)`,
  `<table> <before> -> absent`, and the existing `before -> after (delta)` and `(not counted before)` lines. The
  failure line names the failing tables per reason.
- `deploy.sh.tmpl`: only the comment "A table joins the list after the release that creates it." changes to say it
  may join with that release; the commands and the failure message stay as DF-8 left them (the roadmap's lane note).

**Rejected:** leaving the absent table out of the file (then "absent before" and "not in this list before" look the
same, and the second must keep failing); a flag such as `--allow-absent` (the server would always pass it, so it adds
CLI surface for one caller); passing a table absent before and after (a typo in the list would then disable its
protection silently on every release; failing names it).

**Accepted risk:** a misspelled table name used to stop the release before the switch; now it passes the count
before the switch (absent) and fails the comparison after it, with `<table> absent -> absent` in the log, while the
new release is already live. That is the same state a real drop leaves, the line says what to fix, and the gain is
that a migration and its table can ship in one release.

## Phase 1: row-counts knows an absent table

**Discipline:** test-first.
**Files:** `tools/deploy/src/db/row-counts.ts`, `tools/deploy/src/db/row-counts.test.ts`,
`tools/deploy/src/cli/db-commands.ts`, `tools/deploy/src/cli/run.ts` (usage text if it names the rule),
`tools/deploy/package.json` (devDependency `@electric-sql/pglite`, already in the tree through `@softure-ai/db`),
`tools/deploy/README.md`, `tools/deploy/templates/docker/server/deploy.sh.tmpl` (comment), regenerated
`tools/deploy/e2e/app/docker/server/deploy.sh` (it carries the same comment; `tests/e2e-scripts.test.ts` compares).

1. Tests first (`row-counts.test.ts`):
   - `countRows` on PGlite: an existing table with 2 rows → 2, an existing `billing.subscriptions` → its count, a
     missing `notes` and missing `billing.absent` → `null`; the result keeps the list order.
   - `compareRowCounts`: `counted` kept/gained passes; `counted` drop fails; absent → 0 rows is `new` and passes;
     counted → absent fails; absent → absent fails; a table not in the earlier file fails as `uncounted`; exact
     objects asserted.
   - `rowCountsFileSchema` accepts `null` counts and still refuses negative, fractional and extra keys.
2. Implementation as in the approach; `db-commands.ts` prints the lines and the grouped failure message.
3. README `row-counts` section and the init/server notes; `deploy.sh.tmpl` comment; `npm run e2e-app -w
   @softure-ai/deploy` and check that the diff is that one comment line.
4. Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

**Done when:** the new tests were red before the implementation and are green after; gates green.

## Progress

#### Automated
- [x] Phase 1: row-counts knows an absent table (tests red first, then green) — `350955a`

#### Manual
- [ ] Owner: the release of `@softure-ai/deploy` 0.1.3 carries it; nothing to do in an app.
