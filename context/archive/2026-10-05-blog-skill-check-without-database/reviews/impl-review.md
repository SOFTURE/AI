# Implementation review: blog-skill-check-without-database

Reviewed: the phase 1 commit against plan.md @ 2026-10-05. Verdict: done.
Findings: 0 critical, 0 warnings, 2 notes. No gaps.

## Plan conformance

| Plan item | Delivered |
| --- | --- |
| 1 test | `modules/blog/tests/cli.test.ts`, block "with a config without a database URL": the bin's `skill install` writes the skill (exit 0, `skill: installed into .claude/skills/blog-write`), then `skill install --check` reports it up to date (exit 0, no errors) |
| 2 bin | `modules/blog/src/cli/command.ts`: `COMMANDS_WITHOUT_DATABASE` (`check`, `skill-install`), typed by `BlogCommand["kind"]`, decides `database: "optional"`; any other command stays `"required"` |
| 3 README | the `check` paragraph covers `check` and `skill install` (no URL, `withDatabaseOptional` in an app script); the skill section's CI sentence says no `DATABASE_URL` is needed |

## Checks

- The new test failed before the bin change with the load error (`database.url: must not be empty`) and
  passes after it; the `publish` refusal over the same fixture passes unchanged.
- `modules/blog/tests/` (38 files) green; gates green (typecheck, lint, test, build).
- Diff scanned for non-English text outside message dictionaries: none.

## Notes

- R1 (accepted): the set is typed by `BlogCommand["kind"]`, so a misspelt or removed command kind fails
  typecheck; a new kind is required until someone lists it.
- R2 (accepted): no workflow in this repository runs `skill install --check`; the item's placeholder URL
  lives in an app's own CI, which the README now tells it can drop.
