# Implementation review: host-deploy-user-preflight

Verdict: approved. Scope matches `change.md` and `plan.md`; no drift.

## Findings

1. **Suggestion: collection role keeps its own late check.** `softure.vps_foundation`'s `deploy_user` still locks the
   password before its own sudo check for runs outside `softure-host`. Out of this repository's scope (another
   repository); every `softure-host` run now refuses first. Decision: reported to the coordinator, no change here.
2. **Checked: refusal is read-only.** The probe is a `command` with `changed_when: false`; the `fail` runs before any
   role or task with effects in both playbooks (`server.yml`: separate first play before the bootstrap).
3. **Checked: injection.** The user name reaches the shell as a positional argument (`argv`), and the schema's
   `USER_NAME` pattern limits it to `[a-z_][a-z0-9_-]*`, so the `grep -E` pattern holds no metacharacters.
4. **Checked: tests.** Both new unit tests fail without the refine; e2e steps assert the message and an unchanged
   snapshot. Gates: typecheck and ESLint ran in the pre-commit hook of every commit.
