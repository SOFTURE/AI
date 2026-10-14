# Implementation review: deploy-named-secrets

Reviewed 2026-10-14 against `plan.md` and the diff on `claude/project-thread-8shtbi`.

| # | Finding | Severity | Decision |
|---|---|---|---|
| F1 | No `toJSON(secrets)` and no expression starting with `secrets[` (unquoted) remains in `.github/workflows/`, the deploy action or the environment example; a test guards both shapes. | Check | Holds (`environment-secrets.test.ts`, "the whole secrets context"). |
| F2 | The end-to-end path keeps passing `app-secrets` and `secrets-context: false`, as before (the flag was always false there). | Check | Unchanged behaviour; the e2e job runs in CI. |
| F3 | `VERIFY_ENV_RULES` still lists `VERIFY_ENV_SECRET` as reserved. | Suggestion | Kept: the action still sets that variable in its verify step, so the name stays reserved there. |
| F4 | A token of `secret-names` that is not a name could be a pasted value; it is reported by position only. | Check | Tested ("by position only"). |
| F5 | `examples/deploy.yml` (single `uses:` line) and `init`'s template still build `app-secrets` with `toJSON(secrets)` in the app's own caller. | Suggestion | Documented in the example and README; template change filed as a follow-up issue (D4). |

Gates: typecheck, lint (with the language gate), actionlint 1.7.12 on the workflows and both deploy examples, `vitest run tests/repo tools/deploy` (57 files, 1241 passed). Verdict: ready to archive.
