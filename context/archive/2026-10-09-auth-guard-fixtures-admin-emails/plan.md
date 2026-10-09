---
change_id: auth-guard-fixtures-admin-emails
status: archived
---

# Plan: auth guard redirect, fixture accounts, lenient adminEmails (issue #314)

Input: change.md. Complexity: small (three independent edits in one package).

## Today (master `5b8b4ac`)

- `src/proxy/index.ts`: the login URL is always absolute, on `resolveAppOrigin(config, request, { trustedOrigins })`;
  `exclude` entries match whole segments (`"/"` is the home page only).
- `src/testing/account.ts`: `createTestAccount(db, { email, password, roles?, scrypt? })` hashes on every call,
  lets the database draw the id, stamps `new Date()`, runs no hook.
- `src/options.ts`: `adminEmails: z.array(email)`, so one bad entry fails `auth({ … })`.

## Decisions

1. Guard: `redirect?: "absolute" | "relative"`; relative answers `new Response(null, { status: 307, headers:
   { location: path + search } })` (`Response.redirect` needs an absolute URL). `excludeExact?: string[]`, normalized
   like `exclude` (leading `/` required, trailing `/` dropped, lowercased), compared with the decoded path after its
   trailing `/` is dropped; change-password stays guarded first.
2. `createTestAccount(target: Queryable | AuthContext, input)`; input is a union: `{ password, scrypt? }` or
   `{ passwordHash }` (checked with `isPasswordHash`), plus `id?`, `createdAt?` (also `password_changed_at`),
   `roles?`, `runHooks?`, `fields?`. `runHooks` with a bare database throws before writing. The hook gets
   `{ user, consent: requireConsent ? { acceptedAt: createdAt } : null, fields }` and the context with the
   transaction. Hash memo: a module-level map keyed by parameters and password; a failed hash is evicted.
3. `adminEmails`: `z.union([z.array(email), z.string().transform(parse)])`; the parser splits on commas and
   whitespace, keeps valid entries, and logs once `adminEmails: N of M entries are not email addresses and grant no
   role (positions …)`.

## Phase 1: tests (red on master)

guard.test.ts, testing.test.ts, roles.test.ts as named in change.md.

## Phase 2: implementation, docs

The three sources; README sections 3 and 4; auth 0.1.12 (package.json, module.json, manifest, lock) and its CHANGELOG.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` are green.

## Progress

- [x] Phase 1: tests (22 red on master)
- [x] Phase 2: implementation, README, CHANGELOG
