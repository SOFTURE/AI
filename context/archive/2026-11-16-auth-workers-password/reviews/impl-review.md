# Implementation review: auth-workers-password (RP-3)

Verdict: approve.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `auth().options.password.scrypt` is now `{}` when the app sets nothing; code that read the cost from the parsed module options would get undefined fields. | Checked: every reader in the repository goes through `getAuthOptions`; the CHANGELOG names the change. |
| 2 | Suggestion | A Node-default hash may not verify in a 128 MB Workers isolate. | Documented in README §12 with the migration step (lower the VPS cost first). |
| 3 | Suggestion | The resolved options are cached per parsed object and runtime, so tests building two configs from one module still get the right cost. | Covered by the "same object" test; no change. |

Plan drift: none. Progress matches the diff. Gates: `npx tsc --noEmit`, `npx vitest run modules/auth tests/repo` (1476 passed).
