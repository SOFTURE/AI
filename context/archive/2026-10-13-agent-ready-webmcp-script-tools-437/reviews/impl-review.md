---
change_id: agent-ready-webmcp-script-tools-437
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: agent-ready-webmcp-script-tools-437

Reviewed: the branch diff against plan.md, change.md and issue #437.
Verdict: **approve** after finding 1.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `exactOptionalPropertyTypes` is off, so `messages: { noMatch: undefined }` replaced the default with `undefined` and broke the answer. | Fixed: overrides that are `undefined` are dropped (`mergeMessages`), tested in both forms. |
| 2 | Check | Parity: every behaviour test runs against the TypeScript tool and the tool the boot script registers. A mutation in the script source (definition line) failed only the boot script cases. | No change. |
| 3 | Check | The existing ranking test did not pin the title weight (a weight of 1 still passed). | Added a test that fails without the tenfold weight, in both forms. |
| 4 | Check | Plan review 2 and 3: a message holding `</script><!--` builds and the source holds neither; a `{scope}`-looking query stays as typed. | No change. |
| 5 | Warning | Two copies of the logic. The parity suite is the guard; a comment above the script sources says so. | Accepted. |
| 6 | Check | English answers unchanged: the #415 tests pass with their exact strings. No dictionary ships. | No change. |

Gates: see plan.md Progress.
