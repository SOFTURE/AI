# Plan review: ci-usage-report

Reviewed: plan.md against change.md, research.md and the repository (workflow-runners rules, quality-review shape).
Mode: autonomous (decisions taken, recorded below). Verdict: approve after the fixes below (all applied to plan.md).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | The runs list with a `created` filter returns at most 1,000 runs per query (GitHub's search cap); SOFTURE/AI makes about 1,150 a week, so one weekly query silently drops the oldest runs. | Fixed: the collector queries one day at a time (`created=<day>`), and a day that still reports `total_count` above 1,000 is split into hours; a slice over the cap is a `partial` reason. |
| 2 | Warning | `CI_USAGE_TOKEN` may be a read-only token (Actions read, billing): using it to write the issue would fail, and using `github.token` to read other repositories fails for private ones. | Fixed: `report` uses `CI_USAGE_TOKEN` when set, else `github.token`; `publish` always uses `github.token` (`issues: write` on the caller only). |
| 3 | Warning | SOFTURE/AI's own caller installs the CLI from npm at `cli-version` 0.1.0, which is unpublished until the coordinator releases it: a run before the release fails. | Decided: the own caller has only `schedule` and `workflow_dispatch` (no push or pull request trigger), so nothing runs before the release; the pre-merge evidence is a local run of the built CLI against SOFTURE/AI (Phase 4). |
| 4 | Suggestion | The JSON in the issue body may exceed the body limit for busy repositories. | Already planned: the JSON goes in only when it fits; otherwise the body links the run artifact. |
| 5 | Suggestion | A job that never started but was billed (cancelled after pickup) has `started_at` and no `completed_at`. | Fixed: a job with `started_at` and no `completed_at` in a completed run is billed up to the run's `updated_at`. |

No phase is missing; each contract feeds the next (core types → collector → report → workflow).
