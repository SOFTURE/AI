---
change_id: auth-oidc-display-name-802
verdict: approved
---

# Implementation review

- Plan conformance: steps 1 to 9 done in 8ab2891. One deviation: the shared selection is `AUTH_USER_COLUMNS` in
  `src/schema.ts` (next to the table it selects from) instead of a new `server/user-columns.ts`; `testing/` reads it
  without depending on `server/`. Not exported from the package root.
- Every `AuthUser` the package builds carries `displayName`: sessions, password reset, login, register, OpenID
  Connect (linked, linked now, created) and `createTestAccount`. Existing exact assertions gained `displayName: null`.
- Proof: `oidc-flow.test.ts` "the display name" (first sign-in, session reader, `onRegistered`, refresh, keep without a
  name, linked password account, `given_name` fallback, normalization, 200-character cap, blank and non-string claims
  ignored); `privacy.test.ts` (export, deletion, the database CHECK refuses blank, untrimmed and 201 characters and
  accepts 200 multi-byte characters); the authorize URL test asserts `openid email profile`.
- Consistency: the normalizer collapses every whitespace to a space before trimming, so the JS trim and Postgres
  `btrim` agree; the cap counts code points, as `char_length` does.
- Known limit: format characters (`\p{Cf}`, such as the zero-width joiner of a composed emoji) become a space. Names
  are text, so accepted.
- Gates: typecheck, lint (ESLint, language) and build clean; auth tests 467/467.
