# Plan review: host-deploy-user-preflight

Verdict: approved with one fix applied.

## Findings

1. **Warning: check-mode key line refusal.** In check mode without a key (GitHub already holds DEPLOY_SSH_KEY) on a
   server without the deploy user, `app.yml`'s grep finds no file and the run refuses with the `--rotate-key`
   message. The real run does the same (the role creates an empty file, the grep finds no line), so check mode
   reports what the real run would refuse, as the issue asks. Decision: keep; no change.
2. **Warning: `deploy_user_home` before the role.** The role's defaults may not be visible in `pre_tasks`. Fix
   applied: the report reads the probe's output and names no home path that needs the role's variables.
3. **Suggestion: server.yml in check mode on a fresh server.** The role's remaining tasks only `file`/`copy` with no
   apps (`deploy_user_apps: []`), which pass in check mode (measured). No `when` needed there.
4. **Suggestion: bash 3.2.** `converge.sh` changes use `${mode:+"$mode"}` and a plain `for` loop: no bash 4
   features. It runs only on Linux CI (needs Docker), not in the macOS workflow.
