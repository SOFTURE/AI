---
change_id: marketing-kit-sentence-screen-guard
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: marketing-kit-sentence-screen-guard

Checked `plan.md` against `change.md`, the issue, `src/record/record.ts`, `src/record/actions.ts`,
`src/config/schema.ts`, the fixture and the CI render job.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | A sentence-end check outside any action has no JSON path; an actions film's author would not see which entry to fix. | Accepted: the message names the sentence id and the config file, and the sentence's `screenGuard` is the only place the phrases live (D6). |
| 2 | Warning | The fixture's two films (module and actions) must keep recording the same log, compared frame for frame by the render test. | Accepted: the guard only reads the screen and shoots no frame; the render test proves it with the phrase on the actions twin only. |
| 3 | Suggestion | Checking at the end of the sentence happens after its hold; a number shown only mid-sentence and then scrolled away would fail there. | Accepted: that is what the `checkScreen` inside the sentence is for (D2); README says so. |
| 4 | Suggestion | Issue #175 edits the same files in a sibling thread. | Recorded in change.md Constraints; merge master on conflict. |

No finding blocks the plan.
