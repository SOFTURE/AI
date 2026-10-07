# Plan review: db-app-migration-hooks

Reviewed: `plan.md` against `change.md`, `research.md`, issue #153, `foundation/db/src/**` (migrator, session, adopt,
CLI, testing), drizzle-orm 0.45's migrators and `context/foundation/lessons.md`. Mode: autonomous (owner sets the
goal, the thread decides).

Verdict: **ready after the fixes below** (all applied to `plan.md` or recorded here as decisions).

## Findings

### F1 (Warning, applied): drizzle wraps the database error, so the reason would hide the cause

**Evidence:** drizzle 0.45 throws `DrizzleQueryError` whose message is `Failed query: <sql>` and whose `cause` holds
Postgres's message (`relation "…" does not exist`). Reporting `error.message` alone would print the SQL and drop the
reason, the one thing the operator needs.

**Fix:** the hook failure's `reason` is the message followed by the cause chain's messages (`message: cause`). The
drizzle-recipe test asserts the Postgres message appears for a broken app file. Added to Phase 1.

### F2 (Warning, applied): `--adopt` runs `before` and the adoption under two lock acquisitions

**Evidence:** `adoptModule` takes the lock itself (`adopt.ts:68`); calling `before` first means a second runner can
take the lock between the two. Changing `adoptModule` to accept hooks would enter #152's file.

**Decision:** acceptable. `before` is the app's idempotent runner (drizzle skips applied files) and `adoptModule`
re-reads the journal under its own lock, so an interleaved runner only finds work already done. The CLI runs `before`
through an exported `runAppMigrations(handle, app, "before")` that takes the lock, so the hook itself never races.

### F3 (Warning, applied): a pool of one connection deadlocks the hook under node-postgres

**Evidence:** `withSession` holds one pool client for the whole run; drizzle's migrator asks the pool for another.
With `createDatabase(url, { max: 1 })` the hook waits forever. The CLI uses the default (10).

**Fix:** README §4 states the hook needs a pool with at least two connections; no code guard (the pool size is not
readable in a stable way from `pg.Pool`, and the CLI path is safe).

### F4 (Suggestion, applied): name the problem's subject

**Evidence:** every other problem names a module; `describeProblem` lines start with `<module>:`.

**Fix:** `db.app_migration_failed` prints `app: the <phase> migrations failed: <reason>` so the line reads like its
neighbours, and adds "module migrations before it stay applied" for `after`.

### Checked, no finding

- **Order of checks:** hooks run after `compareJournal` under the lock, so an edited module file refuses before any
  app migration runs; the test "refused run → no hook called" covers it.
- **PGlite single connection:** the hook's drizzle queries share the client the lock is held on; advisory locks are
  re-entrant per session, and drizzle's `BEGIN … COMMIT` runs between module files, never inside one.
- **Scope:** `adopt.ts`, `config.ts` and the bin are untouched; the CLI's adopt branch gains one call (collision with
  #152 is a one-line merge).
- **Lessons:** L-entries on "seen red first" are the plan's done-when; no lesson covers hooks.
