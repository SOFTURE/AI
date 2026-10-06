---
change_id: deploy-init-release-caller
title: "init writes the release caller"
status: archived
roadmap_item: DF-16
branch: claude/df-16-init-release-yml-sof1jo
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`softure-deploy init` writes `.github/workflows/release.yml`, the caller of `deploy-cut-release.yml` (DF-12), next to
the `deploy.yml` it already writes, so a new app can cut a release with *Run workflow* without copying
`tools/deploy/examples/release.yml` by hand. An existing file is kept, as for every file `init` writes, and `--force`
overwrites it.

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-06-2-roadmap.md) (deploy-followups), item **DF-16** (entry:
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:** `softure-deploy init` writes `.github/workflows/release.yml` (the caller of
>   `deploy-cut-release.yml`, as `tools/deploy/examples/release.yml`) next to the `deploy.yml` it already writes,
>   kept when the file exists.
> - **Unknowns:** whether `init` takes the tag time zone as a flag or writes `UTC`.
> - **Source:** DF-12 (`deploy-cut-release`), implementation review: `init` writes the deploy caller only.

## Constraints

- Touches `tools/deploy/templates/.github/workflows/`, `tools/deploy/src/init/generate.ts`, its tests and the README.
- The e2e app (`tools/deploy/e2e/app/`) holds only the files a release ships to the server; the release caller is
  not one, so regenerating it must leave it unchanged.
- `@softure-ai/deploy` stays at 0.1.3: that version is not released yet (DF-11 waits for it), so this change rides it.

## Process notes

- **Research skipped:** the whole surface was read for this note: `init` plans its files from one list
  (`TEMPLATE_FILES` in `generate.ts`), writes them with the keep-unless-`--force` rule, and the example caller and its
  repository test came with DF-12 (`tests/repo/deploy-workflows.test.ts`, "the example release caller"). No unknown
  is left that reading more code would answer.
- **Framing skipped:** the gap was found and scoped by DF-12's implementation review; the outcome is one more
  template on an existing list, with no competing explanation or cheaper path.
- **Decision on the unknown:** `init` writes `timezone: UTC`, as the example does, with a comment naming
  `Europe/Warsaw`; no new flag. The app owns the file after `init` and the zone is one word to change there, while a
  flag would add a validated answer, a README row and a test for a value that only names the tag.
