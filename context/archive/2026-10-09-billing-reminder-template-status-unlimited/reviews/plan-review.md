# Plan review: billing-reminder-template-status-unlimited

Reviewed: plan.md against change.md, issue #323 and the code on master `8b0716f`.
Verdict: **approve after fixes** (applied to plan.md).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A status script on `defineOpsScript` prints "dry run" / "COMMITTED" lines that suggest a write. | Accepted: the runner belongs to `@softure-ai/ops`, which #328 is changing; the script's description says it writes nothing and `run` never writes, so `--commit` is harmless. A read-only mode in ops can follow later. |
| 2 | Warning | A custom `getScope` that is not unique per account and end would mail one account and skip the rest. | Documented on the option and in the README; the default stays unique. |
| 3 | Suggestion | Making `buildMail` sync only would keep the loop simpler. | Rejected: an app template may read the account's name; the option takes a promise. |
| 4 | Check | Every option is opt-in, so 0.1.10 output is unchanged; tests assert the defaults. | No change. |
| 5 | Check | billing 0.1.10 is published (npm), so the bump is 0.1.11. | No change. |

No lesson ignored.
