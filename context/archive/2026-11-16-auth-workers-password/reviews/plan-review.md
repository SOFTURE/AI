# Plan review: auth-workers-password (RP-3)

Verdict: approve with one fix applied.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | Callers outside auth (`examples/next-app/e2e/accounts.ts`, README snippets) read `getAuthOptions(config).password.scrypt`; changing its type to partial would break them. | Applied: `AuthOptions` keeps a full `ScryptParams`, resolved in `getAuthOptions`; the raw parsed shape stays internal. |
| 2 | Suggestion | `createTestAccount` without a context uses the Node default; on a Workers app a test passes a context, so it follows the app. | Accepted as is. |
| 3 | Suggestion | A config in a unit test built without `platform` would crash the resolution. | Checked: every config goes through `defineConfig`, which always sets `platform`. |
