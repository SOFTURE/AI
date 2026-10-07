# Research: auth-security-adoption-gaps

Input: [change.md](change.md), issue #156. Every point was checked against master (`05b5107`).

## Findings per point

| # | Where | Today |
| --- | --- | --- |
| 1 | `modules/auth/src/proxy/index.ts` | `protect` prefixes only; `protect: ["/"]` matches `/login` too (`isUnder` with prefix `/`), so a visitor without a cookie is sent from `/login` to `/login?next=/login` forever. |
| 2 | `server/register.ts`, `options.ts`, `next/pages.tsx`, `ui/auth-forms.tsx` | `RegisteredEvent` is `{ user, consent }`; `registerAction` reads `email`, `password`, `next`, `consent` only. `RegisterForm` takes `consentLabel` but `RegisterPage` never passes it, and has no slot for other inputs. The hook does run inside the action, so it can call `headers()` / `cookies()` itself (analytics' `attributeRegistration` reads the channel cookie that way), but a value the page carries (FIRE's `?z=`) has no way in. |
| 3 | `server/sessions.ts`, `server/change-password.ts`, `server/password-reset.ts`, `scripts/role-scripts.ts` | Sessions are deleted only inside change and reset. No public "end every session" and no script to set a password. The role scripts show the pattern: `defineOpsScript`, `refuseOpsScript`, report before/after, dry run by default. |
| 4 | `server/session-token.ts:97`, `session-cookie.ts` | Token must be 43 base64url chars; the cookie name gets `__Host-` / `__Secure-`. FIRE stores `sha256(token)` hex as well, so only the shape check and the name stand in the way. |
| 5 | `server/password.ts` `deriveKey` | Always derives from `password.normalize("NFC")`. |
| 6 | `modules/security/README.md` §3 | Says development needs an explicit resolver, shows a production/else ternary; no chain for a stack that has a proxy header sometimes (integration stack behind Traefik, plain `next dev`). |
| 7 | `server/rate-limits.ts` `assertAuthBuckets` | All of `BUCKETS` required. The reset functions call it before checking `isPasswordResetEnabled`. |
| 8 | `server/change-password.ts` | No comparison of new and current. |
| 9 | `safe-next-path.ts` | `MAX_LENGTH = 2048`, silent fallback. |
| 10 | `server/login.ts` | Resets `login-account` only; README §3 says "forgets the email's failed attempts, not the address's" but not the consequence for a test suite. |
| 11 | `ui/auth-forms.tsx` `FormShell` | `<Button variant="primary">`, slots `root form footer link notice`. ui's `Button` has `variant` and `classNames` (`root`, `spinner`). |
| 12 | `package.json` | `@softure-ai/ops` in `dependencies`; imported only by `src/scripts/role-scripts.ts`. Mailing is already an optional peer (`peerDependenciesMeta`). |
| 13 | `options.ts:10` | `2 ** 17`, r = 8: scrypt needs 128 · N · r = 128 MiB per hash; Node's libuv pool runs 4 at once by default. |
| 14 | npm | auth `0.1.6` in `package.json` is not tagged or published; `auto-release` publishes the versions on master, on the owner's word. |

## Decisions taken from the code

- Point 4: a legacy session is read, not migrated in the proxy (no database there) nor in a page (pages cannot set
  cookies). It lives until its own expiry or the next login/logout, which clears the legacy cookie. That is the
  "re-issue" without a write path in render.
- Point 7: the check becomes conditional on `passwordReset.send`; the reset functions already return
  `auth.password_reset_unavailable` when it is off.
- Security's code needs no change (point 6 is documentation); its package gets a patch version so the README ships.
