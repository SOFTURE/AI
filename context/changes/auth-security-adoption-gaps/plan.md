# Plan: auth-security-adoption-gaps

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (four phases).

## Goal

All 14 points of issue #156 closed in `@softure-ai/auth` 0.1.6 (unpublished, so no bump) and
`@softure-ai/security` 0.1.6 (README only).

**Out of scope:** forced password change after a temporary password, sliding sessions, publishing to npm.

## Key decisions

- **Guard `exclude`** (point 1): `createAuthGuard(config, { protect, exclude? })`. An excluded prefix wins over a
  protected one, except the change-password route, which is always protected. The login, register,
  forgot-password and reset-password routes and `/api/auth/session` are always excluded, so `protect: ["/"]` cannot
  loop. In `exclude`, `"/"` means the home page only (excluding every path would switch the guard off).
- **Registration fields** (point 2): `auth({ registrationFields: ["channel"] })` declares extra form fields; the
  register action reads only those (strings, cut to 512 chars, empty dropped) and passes them to `registerUser`
  (`fields`), which hands them to `onRegistered` as `event.fields`. Names: `^[a-z][a-zA-Z0-9_]{0,31}$`, never one of
  the form's own (`email`, `password`, `next`, `consent`). `RegisterPage` carries a declared field from its search
  params as a hidden input (FIRE's `?z=`). A field value comes from the client (a crafted link can set it): the README
  says the hook validates it. A `File` entry is ignored. `createRegisterPage({ consentLabel, extraFields })` builds the page with a
  consent label (links to the terms) and visible extra inputs; `RegisterPage` is `createRegisterPage()`.
  `RegisterForm` gets `extraFields`.
- **Revocation** (point 3): `revokeUserSessions(ctx, userId, { except? })` returns the count.
  `createSetTemporaryPasswordScript(config)`: `--email`, generates a random password of
  `max(minLength, 20)` base64url characters, stores its hash, ends every session and the pending reset link, and
  reports it in `after` (only the operator sees it; dry run rolls back).
- **Legacy sessions** (point 4): `auth({ legacySession: { cookieName, tokenPattern } })`. Reads fall back to the legacy
  cookie when the current one is absent, and a token matching `tokenPattern` is looked up by the same sha256. The
  guard counts the legacy cookie too. Login, register and logout end the legacy session and clear its cookie.
  Without the option nothing changes; the README says the alternative is "everyone logs in once".
  `tokenPattern` is a `RegExp` without the `g` or `y` flag (those make `test` stateful), anchored by the module
  (`^(?:…)$`), and `cookieName` must differ from the current cookie's name. The legacy cookie is cleared with
  `Path=/` and the configured domain: the README says a legacy cookie on another path or domain stays until it
  expires (harmless: the session row is ended).
- **NFC** (point 5): on a mismatch, when the input is not NFC, derive again from the raw input; such a match is a
  `legacy` match and login rehashes it (NFC). `verifyPassword` keeps its boolean API. The dummy verification for an
  unknown email goes through the same function, so a non-NFC password costs two derivations for an unknown email as
  for a known one (no timing difference that reveals an account).
- **Buckets** (point 7): the three reset buckets are required only with `passwordReset.send`.
- **Unchanged password** (point 8): `auth.password_unchanged`, at the new password field, after the current one
  verifies (compared in NFC).
- **Next path** (point 9): cap 8192, `console.warn` with the length when a longer one falls back.
- **Submit button** (point 11): `submitVariant` prop on every form (default `primary`) and a `submit` slot in
  `classNames`.
- **ops** (point 12): optional peer like mailing.

## Phase 1: server (TDD)

Points 3 (revokeUserSessions), 5, 7, 8 and the server half of 4.

- `tests/password.test.ts`: an NFD hash verifies with NFD input and reports legacy; NFC input of an NFC hash is a
  plain match. `tests/login.test.ts`: an NFD legacy hash logs in and is rehashed to a hash the NFC input verifies.
- `tests/change-password.test.ts`: same password → `auth.password_unchanged`, nothing changed, sessions kept.
- `tests/module.test.ts` or `login.test.ts`: without `passwordReset.send`, four buckets suffice; with it, missing reset
  buckets are named.
- `tests/sessions.test.ts`: `revokeUserSessions` ends all (or all but `except`), returns the count; a legacy 64-hex
  token is found only with `legacySession`.

Done when: tests seen red, then green.

## Phase 2: guard and cookies

Point 1 and the cookie half of 4: `tests/guard.test.ts` (deny-by-default with exclude, `/` exact, auth pages never
loop, change password always guarded, legacy cookie counts); `tests/cookie.test.ts` (`readSessionToken` falls back
to the legacy name); actions end and clear the legacy session (`tests/actions.test.ts`, new, Next scope mocked as in
`require-user.test.ts`).

## Phase 3: sign-up, forms, next path

Points 2, 9, 11: `tests/register.test.ts` (fields reach the hook), `tests/actions.test.ts` (only declared fields,
trimmed to 512), `tests/module.test.ts` (field names validated), `tests/forms.test.tsx` (extra fields and consent
label render, `submitVariant`, `submit` slot), `tests/safe-next-path.test.ts` (5000-char path kept, 9000 falls back
and warns).

## Phase 4: scripts, packaging, docs

Point 3 script, 6, 10, 12, 13, 14: `tests/role-scripts.test.ts` (or a new `temporary-password.test.ts`): dry run
writes nothing, commit sets a password the login accepts and ends sessions, unknown email refused. ops to an optional
peer, both lockfiles. READMEs (auth §2, §3, §4, §10, §12; security §3), security 0.1.6.

Done when: `npm run typecheck`, `lint`, `test`, `build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: server

- [x] NFC legacy verify and rehash
- [x] unchanged password refused
- [x] reset buckets conditional
- [x] revokeUserSessions and legacy token lookup

### Phase 2: guard and cookies

- [ ] guard exclude and auth pages
- [ ] legacy cookie read, cleared on login, register and logout

### Phase 3: sign-up, forms, next path

- [ ] registration fields and createRegisterPage
- [ ] submit variant and slot
- [ ] next path cap and warning

### Phase 4: scripts, packaging, docs

- [ ] set-temporary-password script
- [ ] ops optional peer, security 0.1.6
- [ ] READMEs
