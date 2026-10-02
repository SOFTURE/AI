# 01 — Assessment: which modules we extract from FIRE_TRACKER

Source: `../../FIRE_TRACKER` (Next 16, React 19, Drizzle + Postgres/PGlite, Tailwind 4, zod 4,
vitest + PGlite, Playwright). The analysis of 2026-10-02 was read-only.

## Why FIRE_TRACKER is a good source

- Almost no runtime dependencies: no auth library, no mail SDK (Resend is called via `fetch`)
  and no UI library. The code is hand-written, so nothing has to be untangled from third-party libraries.
- The same 3-layer convention applies everywhere and is enforced by an architecture test:
  - `*-contract.ts`: result types and errors;
  - `do-*.ts` / `manage-*.ts`: `server-only` logic that receives `database?` and `now`;
  - a thin `"use server"` action that calls the logic and runs `revalidatePath`.

  This is a ready-made skeleton for packages.
- Unit tests run on PGlite (real migrations in memory), and integration tests run on Playwright
  against a real Postgres in Docker. The modules adopt both patterns.

## What blocks extraction across all modules

1. **Hard-coded Polish.** It affects UI copy, route slugs (`/nie-pamietam-hasla`, `/wypisz`),
   identifiers, values in SQL `CHECK` constraints, and the `pl-PL` and `Europe/Warsaw` settings,
   even inside SQL. We need a `messages` and a `routes` layer, and enums must come from configuration.
2. **Monolithic schema and migration journal.** A single `src/db/schema.ts` (2330 LOC) and a
   single linear journal `drizzle/0000…0049`, where generic tables are interleaved with domain ones.
   Module migrations have to be written from scratch, and FIRE will move onto them through *adoption*
   (see [02](02-module-standard.md) and [05](05-adoption-playbook.md)).
3. **`users` mixes responsibilities.** The same table holds identity, billing
   (`paid_until`, `trial_ends_at`) and analytics (`signup_channel`). The modules split these apart.
4. **No roles and no admin concept.** The feature switches panel must require an admin
   authorization hook; the source app had no role concept. The `feature-switches` module gets a
   mandatory `authorize` hook backed by roles from `auth`.
5. **The rate-limit key depends on Cloudflare.** Without Cloudflare (`cf-connecting-ip`) every
   visitor falls into one shared fallback bucket.

## Module catalog

"Domain coupling" says how much has to be parametrized. "Improvements" are gaps in FIRE that the
module fills.

### Foundation (`foundation/`)

| Package | Scope | Source in FIRE |
|---|---|---|
| `@softure-ai/core` | `defineModule`, `defineSoftureConfig`, module registry, `Result`/error codes, `Clock` (`now`), i18n (`messages` + overrides), `locale`/`timezone`, GDPR contributor registry | the `database?`/`now` convention, `src/lib/safe-error.ts`, `plural.ts` |
| `@softure-ai/db` | pg/PGlite client chosen by `DATABASE_URL`, `Database`/`Queryable` types, **module migrator** (Postgres schemas, `softure.migrations` table, adoption mode), `createTestDatabase()` on PGlite | `src/db/client.ts`, `src/db/test-db.ts`, `scripts/migrate.ts` |
| `@softure-ai/ui` | CSS token contract, theme provider, theme switch (cookie + boot script), primitives: `Button`, `Modal`, `Toast`, `Select`, `Switch/Checkbox/SegmentedControl`, form fields, `Card`, `Hint`, `ActionForm`, icons, SVG chart primitives | `src/components/{modal,toast,select,switch,button,form-fields,ui,hint,icons,action-form}.tsx`, `chart/*`, `src/lib/theme.ts`, `globals.css` |

### Modules (`modules/`)

| # | Module | Tables (PG schema) | Coupling | Source in FIRE | Improvements over FIRE |
|---|---|---|---|---|---|
| 1 | **security** | `security.rate_limits` | very low | `src/db/auth-attempts.ts`, `rateLimitKey` in `do-auth.ts`/`api/mcp/route.ts` | buckets from configuration, pluggable IP resolver (Cloudflare / X-Forwarded-For / custom) |
| 2 | **auth** | `auth.users`, `auth.sessions`, `auth.password_resets`, `auth.roles`* | low–medium | `src/lib/{password,session,temporary-password}.ts`, `src/db/sessions.ts`, `actions/{do-auth,auth,auth-contract}.ts`, `login`, `register`, `nie-pamietam-hasla`, `(app)/haslo`, `components/auth-page.tsx`, `proxy.ts`, `scripts/haslo*` | **password reset via an emailed token** (currently a manual owner procedure), **roles/admin**, `onRegistered` hooks, password policy from configuration, routes from configuration, route guard separated from channel tagging |
| 3 | **feature-switches** | `features.switches` | low | `src/db/feature-switches.ts`, `actions/{switches,manage-switches,switches-contract}.ts`, `components/switch-manager.tsx`, `(app)/przelaczniki` | switch registry (name, label, description, default, *fail-open/closed*, env override), **generic list UI**, **`authorize` (admin)** |
| 4 | **mailing** | `mailing.deliveries`, `mailing.campaigns`, `mailing.suppressions` | low (core) / high (templates) | `src/lib/{mail,mail-dns,unsubscribe-link,unsubscribe-footer,list-*,account-send}.ts`, `api/wypisz`, `wypisz/*`, `scripts/{lista-*,konta-*,mail-*}` | provider adapter (Resend first), sender from configuration, templates supplied by the app, *exactly-once* delivery ledger as an API, campaigns over a direct DB connection instead of manual operator scripts, HTML alongside plain text |
| 5 | **waitlist** | `waitlist.signups` | medium | `src/db/waitlist.ts`, `actions/do-waitlist.ts`, `src/lib/{waitlist-consent,waitlist-placement,welcome-mail}.ts`, `components/consent-checkbox.tsx` (the form currently lives in the domain component `calculator-lista.tsx`) | consent scopes and form placements from configuration (no hard-coded `CHECK`s), standalone `WaitlistForm` component |
| 6 | **mcp-access** | `mcp.access_tokens` | low (core) / high (tools) | `src/db/access-tokens.ts`, `src/lib/{mcp-auth,access-token-status,mcp-client-config}.ts`, `api/mcp/route.ts`, `actions/{manage-tokens,tokens}.ts`, `components/{token-manager,token-list,token-issue-form,issued-token}.tsx`, `(app)/mcp` | the app supplies a `createServer({userId, canWrite})` factory and a tools catalog for the UI; server name and client instructions from configuration |
| 7 | **billing** | `billing.entitlements`, `billing.plans`* | medium–high | `src/lib/{access,payment}.ts`, `src/db/access.ts`, `(app)/platnosc`, `cennik`, `components/{pricing-tiles,access-badge,access-notice*}.tsx`, `scripts/dostep*` | entitlements in a separate table instead of `users` columns, plans from configuration, payment adapter (today "manual": pro forma invoice and bank transfer; later Stripe/Przelewy24), `requireWriteAccess` as an API |
| 8 | **privacy** | `privacy.consents` | shell low / content high | `src/db/{account-export,account-deletion}.ts`, `api/moje-dane`, `scripts/delete-empty-account.mts`, `components/{legal-document,legal-section,legal-footer}.tsx`, `legal-text.ts`, `src/lib/owner.ts` | **contributor registry** (every module and the app register `export(userId)`/`delete(userId)`), **consents stored in the database** (today `consent=on` is checked but never stored), self-service account deletion, legal page shell with content from MDX/JSX |
| 9 | **analytics** | `analytics.funnel_counts` | medium | `src/lib/{channel-tag,funnel-steps,funnel-beacon,read-small-body}.ts`, `src/db/funnel-counts.ts`, `actions/do-funnel.ts`, `kalkulator/licznik/route.ts`, `scripts/kanaly-report*` | parameter name, funnel steps, endpoint and time zone from configuration, zero PII (unchanged), report as a function instead of a script |
| 10 | **ops** | — | none | `api/health/route.ts`, `scripts/migrate.ts` (bundled into the image with esbuild), the `--commit` script pattern, `src/lib/{env-prod,release-notes}.ts` | `GET /health` with a registry of module checks, `softure migrate` CLI ready for a Docker image, the "dry run → `--commit`" pattern |

\* New tables that FIRE does not have.

### Tools (`tools/`)

| Package | Scope | Source |
|---|---|---|
| `@softure-ai/marketing-kit` | CLI that generates from `marketing.json` and a brand: 9:16 video (voiceover, frame-by-frame app recording, composition, render), screenshots with quality gates, OG images, post copy | `FIRE_TRACKER/video/**`, `scripts/screenshot.mts`, `opengraph-image.tsx`, `og-*`; details in [03](03-marketing-kit.md) |

### Deliberately skipped (for now)

- **Landing page, marketing sections, SEO** (`components/landing/*`, `robots.ts`, `sitemap.ts`):
  too domain-specific. Wave 3 may add a `public-shell` with data-driven FAQ and pricing sections.
- **MCP server and tools** (`mcp/server.ts`, `mcp/tools.ts`): pure FIRE domain.
  The module takes only the access infrastructure.
- **`/asystent-ai`** is only a redirect to an anchor, not a chat.

## Dependency graph

```
core ◄── db ◄── (every module with tables)
core ◄── ui ◄── (every module with UI)
security ◄── auth ◄── feature-switches
                  ◄── mcp-access
                  ◄── billing
                  ◄── privacy
mailing ◄── waitlist
mailing ◄┄┄ auth            (optional: password reset by email)
security ◄── waitlist, mcp-access
privacy  ◄┄┄ every module holding user data (contributor registration)
```

## Order (waves)

| Wave | What | Why |
|---|---|---|
| 0 | `core`, `db`, `ui` + the module standard | Without them every module invents its own contract |
| 1 | `security`, `auth`, `feature-switches`, `ops` | **`auth` is the reference module**: it has every layer (migrations, actions, pages, UI, i18n). We finalize the standard on it |
| 2 | `mailing`, `waitlist`, `mcp-access`, `privacy` | They depend on auth/security |
| 3 | `billing`, `analytics`, possibly `public-shell` | The most domain logic to untangle |
| ∥ | `marketing-kit` | Independent of the rest; can run in parallel from wave 1 |

After each wave FIRE_TRACKER deletes its own code and switches to the module ([05](05-adoption-playbook.md)).
Only green FIRE integration tests on the module mark that module version as "verified".
