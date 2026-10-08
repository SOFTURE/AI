# Plan review: marketing-kit-signed-in-shots

Reviewed: plan.md against change.md, issue #253, the screenshot code and tests on master `c323892`, and the adopting
app's frame generator. Mode: autonomous; every finding decided and applied to plan.md.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| F1 | Critical | The sign-in phrase is polled while the submit navigates; `innerText` on a page mid-navigation throws "Execution context was destroyed", which would read as a bug instead of a wait. | Accepted: the sign-in wait retries on a navigation error until its deadline. Added to Key decisions. |
| F2 | Warning | A phrase the login page also shows (a "Dashboard" link in its header) passes the sign-in at once, without a session. | Accepted: besides the phrase, the stored state must hold at least one cookie or origin entry, else gate `sign-in` ("no session"). README tells to pick a phrase only the signed-in page shows. |
| F3 | Warning | The plan runs `signIn.prepare` on every run; `shots <id>` of a public entry would seed an account for nothing (and fail without the database). | Accepted: prepare runs only when a selected entry is `signedIn` or uses `{data:…}`; sign-in only when one is `signedIn`. |
| F4 | Warning | Amounts read from the database are numbers, but the page shows them formatted (`12,345 USD`); a number placeholder would never match. | Accepted: README says the preparation prints the text as the page shows it; numbers are accepted and stringified as is. No formatting in the kit. |
| F5 | Suggestion | The crop clip with `fullPage` relies on Playwright treating the clip as document coordinates when `fullPage` is set. | Accepted as a test: a crop of an element below the first viewport must hold the element (dimensions plus a phrase in a pixel-checked colour block is overkill; the test checks dimensions and that a crop far down the page succeeds without scrolling). |
| F6 | Suggestion | `storageState` misses `sessionStorage`; an app keeping its session there would not stay signed in. | Accepted as a README line; no code. |
| F7 | Suggestion | The duplicate gate makes an old config with an identical light/dark pair fail. | Kept as planned (that pair shows a scheme that did nothing, the issue's point 3); CHANGELOG names it. |

## Verdict

Ready for implementation with F1–F4 folded into the Key decisions.
