---
change_id: auth-oidc-sign-in-769
reviewed: 2026-10-25
verdict: approved
---

# Plan review: auth-oidc-sign-in-769

Checked plan.md against change.md, research.md, issue #769 and the auth sources it touches, with an attacker's eye on
each step of the flow.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Two first sign-ins of one identity at once (two tabs) can race: both see no identity, both insert. | Account and identity are written in one transaction: user `ON CONFLICT (email) DO NOTHING` then re-read, identity `ON CONFLICT DO NOTHING` then re-read and compared to the user; a test runs two completions concurrently. Added to Phase 2. |
| 2 | Major | Endpoints from discovery are trusted blindly: a discovery document could point the token call (with the client secret) at another host. | Discovered `authorization_endpoint`, `token_endpoint` and `jwks_uri` must pass the same https rule as the issuer; `requestJson` follows no redirect. Tested with an http token endpoint. |
| 3 | Major | An unknown `kid` refetches the JWKS; without a floor a burst of bad tokens could refetch on every callback. | Refetch at most once per 60 s per issuer (the clock of the context); the callback bucket bounds it further. |
| 4 | Check | Login CSRF: the state must come back to the browser that started it. | The cookie holds the state; the callback compares it in constant time before consuming the row. A test opens the callback without and with another cookie. |
| 5 | Check | Open redirect: `next` is stored at the start and read at the end. | `toSafeNextPath` at both ends, then `rewriteRedirect` as every auth redirect. |
| 6 | Minor | An account created by OIDC has an unusable password; with the password on and reset configured, its owner can still set one through a reset mail. | Intended (the owner controls the mailbox); documented in the README. |
| 7 | Minor | The provider's email can change while `users.email` stays: the identity keeps the account reachable. | `identities.email` is refreshed at each sign-in; `users.email` is not changed (it could collide). Documented under Limitations. |
| 8 | Check | Sizes: an ID token or a claim of megabytes. | The token body schema caps `id_token` at 16 KiB, `sub` at 255, `email` at 254. |
| 9 | Check | Ordering: the start and callback buckets are counted before any network call or database write. | As planned; both in `assertAuthBuckets` when providers exist. |

No Critical findings. Findings 1–3 are folded into Phase 2.
