# Implementation review: blog-check-without-database

Reviewed: the phase 1 commit against plan.md @ 2026-10-05. Verdict: done.
Findings: 0 critical, 0 warnings, 3 notes. One gap goes to the roadmap (R1, from plan review S1).

## Plan conformance

| Plan item | Delivered |
| --- | --- |
| 2 flag | `foundation/core/src/database-requirement.ts`: `withDatabaseOptional(load)` (set, await, restore in `finally`) and the internal `isDatabaseOptional()`, on `globalThis[Symbol.for("softure-ai.core.database-optional")]` |
| 3 config | `defineSoftureConfig` parses with `database: null` when the flag is on and the input has no non-empty string URL, and skips `checkDatabase` then |
| 4 loader | `loadConfig(path, appScript, { database })`, `loadAppConfig({ …, database })`, `DatabaseRequirement` and `LoadConfigOptions` exported from `@softure-ai/core/cli`; default `"required"` |
| 5 bin | `softure-blog` passes `"optional"` for `check` only |
| 6 workflow | `blog-links.yml` drops the `database-url` input and the job's `DATABASE_URL`; the header says why |
| 7 READMEs | core §3 (the opt-out) and §4 (the loader option); blog's `check` paragraph (no URL needed; the app-script variant) |

## Checks

- Core: `config.test.ts` (missing, `null`, empty and unset URL with a `dbSchema` module give `null`; a real
  URL is kept; other problems still reported; the flag is off after a resolved and a rejected load);
  `cli.test.ts` (a fixture config that throws by default loads with `database: "optional"`).
- Blog: `cli.test.ts` runs the bin's `check` over a config without a URL (no error, the gate's summary
  line) and `publish` over the same config (the load failure, exit 1). Both failed before the bin change.
- The existing db, mailing and blog bin tests pass unchanged; gates green (typecheck, lint, test, build).

## Notes

- R1 (gap, BF-13): `skill install` never connects either; it keeps requiring the URL (plan review S1).
- R2 (accepted): Node keeps a module's first evaluation, so the tests copy each fixture config to a fresh
  folder per load; the core README says a process loads the config one way.
- R3 (accepted): in optional mode a `database` whose URL is not a string (e.g. a number) also reads as
  `null` rather than a type error; such a config is refused by any command that needs the database.
