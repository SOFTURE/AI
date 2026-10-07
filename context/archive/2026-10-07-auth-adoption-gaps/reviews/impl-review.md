# Implementation review: auth-adoption-gaps

Reviewed: the phase 1 diff (`modules/auth/src/next/actions.ts`, `src/next/logout-button.tsx`,
`src/next/index.ts`, `src/proxy/index.ts`, the three test files, README, CHANGELOG) against `plan.md`,
`change.md` and issue #193.

Verdict: **approve**. No open findings.

## Plan conformance

| Plan item | Delivered | Evidence |
| --- | --- | --- |
| `logoutAction(input?: FormData \| LogoutInput)`, input narrowed with zod, `toSafeNextPath` fallback to `afterLogout` | yes | `actions.ts` `readLogoutNext`, `logoutInput`; tests "logout's return target" (object, form, none, five refused paths, four non-object inputs) |
| `LogoutButton next` as a hidden field | yes | `logout-button.tsx`; `pages.test.tsx` "the logout button" |
| `trustedOrigins`, forwarded headers → `Host` → URL, allowlist only, creation-time validation, trailing `/` | yes | `proxy/index.ts` `normalizeOrigin`, `findPublicOrigin`, `parseOrigin`; `guard.test.ts` "trusted origins" (15 cases) |
| README: logout target, `trustedOrigins`, `cookie.secure`, Vitest note | yes | README §2, §3 cookie row and paragraph, §4 server actions and route guard |
| Point 3 decided as documentation, specifiers stay bare | yes | `next-modules.d.ts` measurement; README §2 |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | `parseOrigin` kept an unused `exec` match with capture groups. | Fixed: a plain `test`. |
| 2 | Suggestion | The guard computes the public origin even when `trustedOrigins` is empty. The cost is one header read and one `URL` parse on the redirect path only (sessions return earlier). | Kept: the redirect is not a hot path, and one code path is simpler to read. |

## Checks

- Red first: 13 new tests failed before the implementation (run on the test-only tree) and pass after.
- No open redirect: logout targets pass `toSafeNextPath`; the guard uses only `appOrigin` or a listed
  origin. Spoofed `X-Forwarded-Host` values (unlisted, with a path, with credentials, unparsable, wrong
  scheme) all fall back to `appOrigin` (tests).
- Backwards compatibility: `logoutAction()` still goes to `/login`; a guard without the option still
  redirects every host to `appOrigin` (tests).
- Server action file: `actions.ts` keeps `"use server"`; the new exports are a type and the action, the
  helpers stay private.
- The Vitest note is true: a scratch Vitest project importing the built `@softure-ai/auth/next` from
  `node_modules` failed with `Cannot find module '…/node_modules/next/headers'` and passed with
  `server.deps.inline: [/@softure-ai\//]`.
- Language gate, typecheck, lint, tests and build: see `plan.md` Progress.
