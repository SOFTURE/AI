---
change_id: mcp-registration-window-520
status: archived
---

# Plan: closed OAuth client registration with a timed window (issue #520)

Input: change.md, research.md. Complexity: medium (option, migration, server functions, route gate, two scripts,
docs).

## Phase 1: option, table and server functions (TDD)

Files: `src/options.ts`, `migrations/0003_create_oauth_registration_window.sql`, `src/schema.ts`,
`src/server/registration-window.ts`, `src/server/index.ts`, `src/index.ts`, `module.json`, `src/server/health.ts`,
`tests/registration-window-520.test.ts`.

1. Tests first: the option defaults to `"open"` and refuses another value; the table takes one row only and a
   window that ends before it opened is refused; `openClientRegistration` stores `now + minutes`, a second call
   replaces it; `closeClientRegistration` deletes it; `isClientRegistrationOpen` is true for `"open"`, and for
   `"closed"` only while `open_until > now`.
2. Implement migration (`id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1)`, `opened_at`, `open_until`,
   `CHECK (open_until > opened_at)`), schema, functions, manifest table, health check.

## Phase 2: the route gate (TDD)

Files: `src/server/oauth-http.ts`, the same test file.

1. Tests first: closed without a window → 403 `access_denied` and no client row; inside a window → 201; after it →
   403; counted in the rate limit; a failing window read → 503; discovery keeps `registration_endpoint`.
2. Implement the gate after the rate limit, before the body read.

## Phase 3: ops scripts (TDD)

Files: `src/scripts/registration-scripts.ts`, `src/scripts/index.ts`, `package.json` (`./scripts` export, optional
`@softure-ai/ops` peer), the same test file.

1. Tests first: dry run reports before/after and writes nothing; `--commit` opens for N minutes; minutes outside
   1–1440 or not a number are refused by the schema; both scripts refuse while `oauth.enabled` is off or
   `oauth.registration` is `"open"`; close refuses when no window is open.
2. Implement.

## Phase 4: docs

`README.md` (option row, "Closed registration" paragraph, tables section, server functions),
`CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: option, table and server functions (`d378fda`; tests written first, red on the missing entries)
- [x] Phase 2: the route gate (`d378fda`)
- [x] Phase 3: ops scripts (`d378fda`; `/scripts` entry, optional `@softure-ai/ops` peer)
- [x] Phase 4: docs (`d6f1c83`; README option row, "Closed registration", §5, §10, CHANGELOG `## Unreleased`)

Gates on the branch: `npm run typecheck`, `npm run lint` and `npm run build` green; mcp-access tests 278 passed
(19 new), repository tests 545 passed; the full `npm test` runs in pre-push.
