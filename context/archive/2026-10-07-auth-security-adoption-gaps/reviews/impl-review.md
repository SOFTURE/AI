# Implementation review: auth-security-adoption-gaps

Reviewed: the branch against [plan.md](../plan.md) and issue #156, every phase, with the diff read adversarially
(what would let an anonymous visitor through, leak an account's existence, or break an existing app).

## Point by point

| # | Issue point | Delivered | Evidence |
| --- | --- | --- | --- |
| 1 | Deny-by-default guard | `exclude`, auth's public pages and `/api/auth/session` never guarded, `"/"` in an exclusion is the home page | `tests/guard.test.ts` "deny by default" |
| 2 | App data at sign-up, consent label | `registrationFields` → `event.fields`, carried from the URL; `createRegisterPage({ consentLabel, extraFields })`; `RegisterForm.extraFields` | `register.test.ts`, `actions.test.ts`, `pages.test.tsx`, `forms.test.tsx` |
| 3 | Revocation API, temporary password script | `revokeUserSessions(ctx, userId, { except? })`; `createSetTemporaryPasswordScript` | `sessions.test.ts`, `temporary-password.test.ts` |
| 4 | Adopters log everyone out | `legacySession: { cookieName, tokenPattern }`: read, guarded, ended and cleared at login, register, logout; README "Adopting existing sessions" | `sessions.test.ts`, `guard.test.ts`, `actions.test.ts`, `module.test.ts` |
| 5 | NFC at verify time | `matchPassword` retries the raw input, login rehashes a legacy match in NFC | `password.test.ts`, `login.test.ts`, `password-timing.test.ts` |
| 6 | Unidentified client fallback | security README: resolver chain for dev and test stacks, why the constant stays out of production | README §3 |
| 7 | 7 buckets with reset off | reset buckets required only with `passwordReset.send` | `login.test.ts` |
| 8 | New = current accepted | `auth.password_unchanged` (NFC compare), copy in en and pl | `change-password.test.ts`, `messages.test.ts` |
| 9 | Next path cap 2048, silent | cap 8192, warning with the length; the actions keep the whole path (they cut form text at 4096 before) | `safe-next-path.test.ts`, `actions.test.ts` |
| 10 | Per-IP login bucket never reset | README §3 says so and what a test suite does | README |
| 11 | Submit button | `submitVariant`, `classNames.submit` on every form | `forms.test.tsx` |
| 12 | ops a hard dependency | optional peer, like mailing; README §2 | `package.json`, lockfile |
| 13 | scrypt memory | option comment and README table: 128 × N × r, pool of four, smaller costs | `options.ts`, README §3 |
| 14 | 0.1.6 not on npm | auth stays at the unpublished 0.1.6 and now carries all of the above (with `./testing`); security 0.1.6 for its README. Publishing is the `auto-release` run, a separate release step | `package.json`s |

Every new test was run against the code without the change and failed, then passed with it.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | Auth's public pages were excluded as prefixes: an app that mounts its login page at `/` would have excluded every path and switched the guard off. | Fixed: the home-page rule applies to auth's own routes too (`isExcludedBy`); test "keeps guarding everything else when the app mounts its login page at /". |
| 2 | Warning | The login and register actions cut every form field at 4096 characters, so a `next` path between 4096 and 8192 was cut and still accepted, a broken redirect. | Fixed: `next` is cut one character over the cap, so an overlong path stays overlong; test with a 6000-character path. |
| 3 | Warning | Removing a `__Host-` legacy cookie with a Domain (or without Secure) is ignored by browsers. | Fixed: such a removal goes without Domain and with Secure. |
| 4 | Suggestion | A temporary password is not forced to change. | Kept: documented in README §4 and §12; a forced change is a feature of its own, outside the issue. |
| 5 | Suggestion | `registrationFields` values are client input, also through the carried URL parameter. | Kept by design and documented in §10 (validate in the hook); lengths are bounded (512 server side, 512 echoed). |

No open findings. Gates: `npm run typecheck`, `lint`, `test`, `build` (results in the PR).
