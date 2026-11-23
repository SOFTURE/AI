---
change_id: host-app-add-missing-variables
verdict: approved
---

# Implementation review

Reviewed the diff against `plan.md` and issue #1434.

- **Acceptance 1:** compose with `${APP_HOST:?}` and `${MAIL_KEY:?}`, nothing set: only `MAIL_KEY` is reported.
- **Acceptance 2:** a repository variable and a `production` variable are not reported.
- **Acceptance 3:** `--check` with a missing Environment reads no secrets and no Environment variables; the repository
  variable listing is outside the Environment, so it is allowed.
- Only names are requested (`--json name`); no value reaches the output.
- Deviation from the issue (one list, not two) recorded under Decisions (auto) with its reason.

Findings: none.
