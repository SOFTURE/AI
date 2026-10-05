# Plan: blog-check-without-database

Input: change.md, research.md. Complexity: small (one phase).

## Goal

- `softure-blog check` loads an app config whose `database.url` is missing or empty, or whose
  `database` is `null` while `blog()` is listed; the config it gets has `database: null`.
- `softure-blog publish`, `softure-blog skill install`, `softure migrate` and `softure-mail` load the
  config as today (database required).
- `.github/workflows/blog-links.yml` drops the `database-url` input and the `DATABASE_URL` variable.

**Out of scope:** other commands that never connect (none known); release or version bumps (releases
stay with the owner).

## Approach

**Starting point:** `defineSoftureConfig` throws inside the app's config module (research §Current state).

**Chosen:** research option 2, a scoped opt-out in core that the loader sets around the import.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Signal | `globalThis[Symbol.for("softure-ai.core.database-optional")]`, set and restored by `withDatabaseOptional` | reaches every copy of core in the process; no leak into child processes | research |
| Public helper | `withDatabaseOptional(load)` in `@softure-ai/core` | an app script that imports its config can wrap the import | research |
| Loader option | `database?: "required" \| "optional"` (default `"required"`) on `loadAppConfig` and `loadConfig` | alternatives as a union, not a boolean flag | AGENTS.md |
| What "optional" accepts | `database` missing, `null`, or `{ url }` with `url` not a non-empty string → `null`; the dbSchema check skipped | covers the three ways an app writes it (research) | research |
| A real URL in optional mode | kept | `publish` sees nothing different; no value is invented | plan |
| Which blog commands | only `check` | the only command that never connects; `skill install` keeps today's behaviour | plan |

## Phase 1: Optional database for `softure-blog check`

**Discipline:** TDD. **Files:** `foundation/core/src/database-requirement.ts`, `foundation/core/src/config.ts`,
`foundation/core/src/index.ts`, `foundation/core/src/cli/load-config.ts`, `foundation/core/src/cli/index.ts`,
`foundation/core/tests/config.test.ts`, `foundation/core/tests/cli.test.ts`, `foundation/core/README.md`,
`modules/blog/src/cli/command.ts`, `modules/blog/tests/cli.test.ts`,
`modules/blog/tests/fixtures/app-without-database/softure.config.mjs`, `modules/blog/README.md`,
`.github/workflows/blog-links.yml`.

1. Tests first (core `config.test.ts`, `cli.test.ts`; blog `cli.test.ts`), failing.
2. `database-requirement.ts`: `withDatabaseOptional<T>(load: () => Promise<T> | T): Promise<T>` sets the
   flag, awaits `load`, restores the previous value in `finally`; `isDatabaseOptional(): boolean`
   (internal, not exported from the root).
3. `config.ts`: in `defineSoftureConfig`, when `isDatabaseOptional()` and the input database has no
   non-empty string `url`, parse with `database: null` and skip `checkDatabase`.
4. `load-config.ts`: `LoadAppConfigOptions.database?: DatabaseRequirement` and a third `options`
   argument of `loadConfig`; the import runs inside `withDatabaseOptional` when `"optional"`.
   `DatabaseRequirement = "required" | "optional"` exported from `@softure-ai/core/cli`.
5. Blog `command.ts`: `database: command.kind === "check" ? "optional" : "required"`.
6. Workflow: drop the input and the variable; the header says `check` loads a config without a URL.
7. READMEs: core §3 (the opt-out and `withDatabaseOptional`) and §4 (the loader option); blog's `check`
   paragraph (no database URL needed, app-script variant with `withDatabaseOptional`).

**Tests:** core: inside `withDatabaseOptional`, a module with a `dbSchema` and a missing, empty or
`null` database gives `database: null`; a real URL is kept; outside, the same inputs still throw; the
flag is off again after `load` resolves and after it rejects. Core cli: `loadAppConfig` with
`database: "optional"` loads a config file that throws without it, and the default refuses it. Blog bin:
`check` over the fixture `app-without-database` (blog listed, `database.url` from an unset variable) runs
the gate (exit 0, `OK` lines); `publish` with the same fixture reports the load failure (exit 1).

**Done when:**
- Automated: the new tests pass; the existing core, db, mailing and blog cli tests pass unchanged;
  `grep -n "DATABASE_URL\|database-url" .github/workflows/blog-links.yml` is empty; gates green
  (typecheck, lint, test, build).

## Risks and rollback

- The flag stays set after a failed import → `finally` restores it; a test covers a rejecting `load`.
- Rollback: revert the phase commit; the workflow input can return with it. Nothing persistent changes.

## Decisions (auto)

- Opt-out in core or a check-only config in the bin? → core (research: the bin cannot catch the throw).
- `skill install` optional too? → no; out of the item, and it reads nothing that needs the change.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Optional database for `softure-blog check`

#### Automated
- [x] 1.1 Core tests pass (optional mode in `defineSoftureConfig`, flag restored, loader option) — 59a4452
- [x] 1.2 The bin's `check` runs over a config without a database URL; `publish` still refuses it — 59a4452
- [x] 1.3 The existing core, db, mailing and blog cli tests pass unchanged — 59a4452
- [x] 1.4 The reusable workflow has no `database-url` input or `DATABASE_URL` variable — 59a4452
- [x] 1.5 Gates green (typecheck, lint, test, build) — 59a4452
