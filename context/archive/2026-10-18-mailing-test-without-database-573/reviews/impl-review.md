---
change_id: mailing-test-without-database-573
reviewed: 2026-10-18
verdict: approved
---

# Implementation review: mailing-test-without-database-573

Reviewed: the branch diff against plan.md, change.md and issue #573.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance "`database: null` sends a list mail with the footer and RFC 8058 headers to `testAddress`, exit 0": pinned in `cli.test.ts` through `runMailCli` and through the bin with an empty database URL; no database is opened. | No change. |
| 2 | Check | Acceptance "without the secret it still refuses": `sendMailUnchecked` answers `unavailable` (cause `no_unsubscribe_secret`), nothing sent (tested). | No change. |
| 3 | Check | Acceptance "with a database the current behaviour stays": the existing `suppressed` test passes unchanged; the skip depends on `database === null` only, so a configured but unreachable database still fails. | No change. |
| 4 | Check | `sendMailUnchecked` is not re-exported from `/server`; its one caller fixes `to` to `testAddress`. `sendMail` keeps its fail-closed checks; the provider call moved into `deliver` unchanged. | No change. |
| 5 | Minor | The bin test cannot also assert that `campaign` refuses the same fixture: Node caches the config module, so a second load in one process returns the first result. Covered instead by the existing "the config has no database" campaign path. | No change. |
| 6 | Check | README Test send, help text, CHANGELOG `## Unreleased` with the app migration (`withDatabaseOptional` for an app script); no version bump. | No change. |
