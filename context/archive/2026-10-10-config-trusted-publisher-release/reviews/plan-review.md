---
change_id: config-trusted-publisher-release
reviewed: 2026-10-10
verdict: approved
---

# Plan review: config-trusted-publisher-release

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Provenance on npm does not prove OIDC: 0.1.0 has it from the token publish. The check is the workflow notice. | Runbook says so. |
| 2 | Check | The workflow sends `NPM_TOKEN` only for a package not yet on npm, so 0.1.1 cannot fall back to the token. | No change. |

No Critical findings.
