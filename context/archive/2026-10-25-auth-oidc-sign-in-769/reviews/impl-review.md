---
change_id: auth-oidc-sign-in-769
reviewed: 2026-10-25
verdict: approved
---

# Implementation review: auth-oidc-sign-in-769

Reviewed `git diff origin/master` (55 files) against plan.md, the plan review and issue #769, reading each step of the
flow as an attacker would.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Login CSRF: the callback compares the cookie's state with the query's in constant time before it touches the row, so a foreign callback cannot consume or burn a victim's sign-in. Tested (no cookie, another cookie, replay). | No change. |
| 2 | Check | ID token: algorithms pinned to RS256/ES256 (`alg: none` and HMAC refused before any key lookup), key type matched to the algorithm, ES256 curve checked, `iss`, `aud`, `azp`, `exp`, `iat`, `nonce` each tested with its own refusal. | No change. |
| 3 | Check | Allowlist: email lowercased on both sides, subdomains do not match, `email_verified` required (boolean or `"true"`), `hd` required for Google domain matches. Tested. | No change. |
| 4 | Minor | The unusable password is hashed inside the account transaction (one scrypt, first sign-in only), holding the transaction for its duration. | Accepted: hashing before it would cost a scrypt on every sign-in of an existing account; first sign-ins are rare. |
| 5 | Minor | A race where another browser links the same subject to a different account between the insert and the re-read leaves a created account without identity. | Accepted: needs two different accounts with one subject at the same instant; the next sign-in finds the linked one, and the orphan holds no password anyone knows. |
| 6 | Check | Logs: the reason behind `auth.oidc_failed` is the module's own wording; the only provider-derived part is an OAuth error code restricted to `[a-z_]{1,64}`. No token, code, state or email is logged. | No change. |
| 7 | Check | `"use server"` file exports only async functions; the redirect helpers moved to `previous-session.ts` and `oidc-login-url.ts`. | No change. |
| 8 | Check | Additive for existing apps: defaults unchanged except the two new buckets (required only with a provider); `RegisteredEvent.oidcProvider` and `ChangePasswordErrorCode` grow (types only). Privacy's tests updated for the new table. | Noted in the CHANGELOG. |

Gates: typecheck, lint, language green; `npm test` for auth, privacy, connections and the repository tests green
(1326 passed); `npm run build` green. The manual check 3.3 (a real Google sign-in) waits for an adopting app after
the release.
