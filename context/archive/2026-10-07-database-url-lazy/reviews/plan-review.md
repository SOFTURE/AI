# Plan review: database-url-lazy

Reviewed: `plan.md` against `change.md`, issue #155 and the code (2026-10-07). Verdict: **ready**, two findings
applied to the plan below.

## Checks

| Area | Result |
| --- | --- |
| Covers the issue | Both measured failures (`--export-migrations`, `next build`) come from config evaluation; dropping the eager check fixes both. The issue's third ask (README matches the example app) is covered by the docs step. |
| Every connection path explains an empty URL | All 13 consumers reach `createDatabase`: `getSharedDatabase` (module adapters), `softure migrate`, ops scripts, ops `getHealthDatabase`, blog and mailing CLIs, the example app's scripts and `lib/database.ts`. Both shared caches (`getSharedDatabase`, `getHealthDatabase`) drop a rejected open, so the refusal is not cached. |
| Ops health route | `{ url: "" }` is not `pglite://`, so it goes to `getHealthDatabase`, whose rejection is logged and answered as `503 unavailable`: a deployment without `DATABASE_URL` fails its health check, which `verify-production` and the deploy watch read. Acceptable replacement for the lost import-time failure. |
| Type ripple | None: `SoftureConfig.database` stays `{ url: string } \| null`. |
| `withDatabaseOptional` | Unchanged: it still maps an empty URL to `null` before the schema, so `softure-blog check` keeps reading "no database". |
| Conflicts with #152/#153/#154 | Edits are one schema line and one JSDoc in `config.ts`, three lines in `client.ts`; no shared new keys. |
| Tests seen red | The client test is red today (message is "unsupported database URL scheme (none)"); the config test is red (throws); the CLI export test is red only via the config, so it builds the config through `defineSoftureConfig` rather than a literal. |

## Findings

1. **Warning: the CLI export test would pass on the old code.** `cli.test.ts` builds config literals, never
   calling `defineSoftureConfig`, and the export path never reads the URL. Fix: the new export case builds its
   config with `defineSoftureConfig({ database: { url: "" }, … })`, so it fails on the old schema. *Applied: noted
   in Phase 1.*
2. **Suggestion: docs/02 §7 uses `process.env.DATABASE_URL!`.** At build time that is `undefined`, which still
   fails `z.string()`; the plan already switches it to `?? ""`. Keep `undefined` refused (TypeScript types it as
   `string`, so `!` hides a real bug). *Applied: stays in Goal and Out of scope.*

No blocking findings.
