# Implementation review: adoption-gaps-ops-switches-deploy-core

Reviewed: commits `08942bd` (ops), `fb308bf` (feature-switches, core, manifests), `e535d7a` (deploy) and `1fb08fe`
(CHANGELOGs, docs, versions) against `plan.md`, `change.md` and issue #158. Verdict: **approved**, no open findings.

## Plan conformance

| Point | Decision | Where | Evidence |
|---|---|---|---|
| 1 recipes for an app that owns `public` and its ledger; reusable roles | D1 | `01-roles.sql` (role created only when missing, password required only then), `existing-database.sql` (`SOFTURE_APP_SCHEMAS`, default `public,drizzle`, keeps their owner) | Postgres 16 run below, scenarios A–D |
| 2 ledgers read-only for the app role | D2 | event trigger `softure_ledgers_read_only` in `01-roles.sql`; `REVOKE` for ledger schemas in `existing-database.sql`; `examples/next-app/scripts/container.mjs` asserts INSERT and DELETE denied, SELECT allowed | recipe run; container check runs in the e2e workflow |
| 3 secrets off argv | D3 | `OpsScript.secrets`, `--<key>-file=<path\|->`, `OpsInputReader` | `ops-script` tests: file, stdin, both given, empty path, two stdin readers, unreadable path; the value never appears in an error |
| 4 health route dynamic | D4 (revised) | `await connection()` first in `GET` | re-exporting `dynamic` failed `next build` ("It mustn't be reexported", measured); route test asserts `connection()` per request |
| 5 docs drift | D5 | ops and db READMEs: one export command, `server-only` and alias note, compose variable names as in §6 | export command tried in a scratch app with `tsx --conditions=react-server` and an esbuild alias |
| 6 one-way override | D6 | `override: "both" \| "towards-fail-mode"`, ignored value logged once | switch tests: towards the fail mode applies, the other way is ignored and logged once, default keeps both |
| 7 deploy without host Node | D7 | `deploy.sh.tmpl`: `deploy_cli`, `node_eval`, helper image `softure-deploy-tools:<cli>-pg<major>` | server-files test on a PATH without Node, seen red on the old template |
| 8 deploy README path, 0.1.3 | D8 | README `/app/softure-migrations`; 0.1.3 released after the merge | release run |
| 9 deliberate domain message | D9 | core `PublicError`, `isPublicError`, `getPublicMessage` (brand `Symbol.for`) | tests incl. a foreign object carrying the brand |
| 10 plural rules cache | D10 | per-locale `Map` | constructor spy: at most two builds for two locales |
| 11 manifests vs dependencies | D11 | waitlist `auth`; auth `mailing ?`, `ops ?`; billing `mailing ?`, `ops ?`; analytics `security ?` | new repository test (analytics was caught by it) |
| 12 CHANGELOGs | D12 | `CHANGELOG.md` in every package and the template, in `files`; `release:version` renames `## Unreleased` | package test (seen red before the files existed); `release-version` tests |
| 13 stale READMEs | D13 | testing README; core and db already fixed on master by #160 | `setupFiles` with the bare specifier checked with a probe config |

## Recipe run (Postgres 16, local cluster)

Nineteen checks, all `ok`:

- A, fresh cluster: both roles created; a second run keeps them and leaves the migrator password unchanged.
- B, existing database where the app owns `public` and `drizzle`: `public` and `drizzle` keep their owner, module
  schemas go to `softure_migrator`; the app role writes `public` and module tables, reads both ledgers, and is refused
  INSERT on `softure.migrations` and `drizzle.__drizzle_migrations`; the app owner still migrates its ledger; a table
  the migrator creates later in a ledger schema is refused to the app role too (event trigger).
- C, the app's migration role reused as the migrator: no migrator password needed, the ledger is created, and the app
  role is refused writes.
- D, a role that would be created without its password: refused with the variable names, nothing created.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Warning | Plan F3: the optional `dependsOn` entries move ops and mailing before auth and billing when an app lists them. | Accepted. The migrator checks order per module, so existing ledgers stay valid; the full suite and the example app pass. |
| R2 | Suggestion | `PublicError` messages are not localised by core; the app chooses the text it throws. | Accepted: that is the point of a deliberate message. |
| R3 | Suggestion | The helper image is built on the server on first use and cached by tag. | Accepted; README host requirements name it. |

## Gates

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`: green (see the Progress SHAs).
