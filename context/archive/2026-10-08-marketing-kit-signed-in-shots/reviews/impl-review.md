# Implementation review: marketing-kit-signed-in-shots

Reviewed: the branch against plan.md (Key decisions, F1–F4 of the plan review) and issue #253, by reading the diff
of `tools/marketing-kit` adversarially and by sabotage runs of the new gates. Mode: autonomous; every finding decided.

## Against the plan

| Plan item | Where | Verdict |
| --- | --- | --- |
| `signIn` block, `signedIn`, one sign-in per run, session in memory | `src/config/schema.ts`, `src/screenshot/sign-in.ts`, `takeScreenshots` | done |
| Navigation-tolerant phrase wait, "no session" refusal (plan review F1, F2) | `readPageText`, `signIn` | done; sabotage of the session check turns its test red |
| Steps (`fill`, `click`, `check`, `press`), 10 s each, gate `steps`, values never printed | `src/config/shot-steps.ts`, `src/screenshot/steps.ts` | done |
| `prepare` command, data from the last line, output not echoed, runs only when needed (F3) | `src/screenshot/prepare.ts`, `prepareShotTexts` in `src/cli/main.ts` | done |
| `{env:…}`/`{data:…}` placeholders, config check, early unset-variable stop, path encoding | `src/config/placeholders.ts`, `src/screenshot/shot-texts.ts` | done |
| Duplicate gate (SHA-256 over kept files of a run) | `refuseDuplicate` | done; it caught two identical files in an existing test and in the fixture's light/dark pair |
| Crop: one match, document coordinates via `fullPage` + `clip`, edge refusal, dimension gate | `measureCrop`, `findCropFrame`, `findDimensionFailure` | done; dropping `fullPage` turns the crop tests red |
| `getLocator` moved to `src/record/locator.ts` | | done, re-exported from `actions.ts` |
| README, CHANGELOG, version 0.1.10 | | done |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| R1 | Critical | `shots` checked that the app answers on the first entry's path. With a placeholder there (`/accounts/{data:id}`) the probe gets a 404 before the preparation, so the CLI would start a second app or time out. | Fixed: the probe uses the first path without a placeholder, else `/`. The CLI test now takes both the phrase and the path from the preparation. |
| R2 | Warning | The fixture app ignored the colour scheme, so its light and dark files were byte-identical and the new duplicate gate refused the dark one (an existing CLI test went red). | Fixed in the fixture, not the gate: a `prefers-color-scheme: light` rule. Films record dark, and the token reader ignores `@media`, so nothing else changes. The behaviour change for such configs is in the CHANGELOG and the 0.1.10 upgrade notes. |
| R3 | Warning | The existing motion test took two entries with the same page, scheme and motion: identical files, now refused. | Fixed in the test (another width for one entry), with a comment naming the gate. |
| R4 | Suggestion | A key in the preparation's JSON whose value is `null` would be refused; an app may want "no value". | Kept: a phrase gate needs text; the error names the key. |
| R5 | Suggestion | `shots --page` cannot sign in through `signIn`. | Kept out of scope (plan): `--page` targets any origin; `--auth` stays. |
| R6 | Suggestion | The failing-sign-in message prints the URL path of the page reached, not the full URL. | Kept on purpose: a query string after a sign-in may carry a token. |

## Tests seen red

- crop geometry and dimension tolerance (sabotaged bounds and tolerance);
- crop without `fullPage` (element far below the viewport, sticky header pixel);
- sign-in without the session check;
- duplicate gate (existing tests failed before R2/R3 were fixed);
- CLI probe on a placeholder path (R1; the test times out without the fix).

## Verdict

No open findings. Gates: see plan.md Progress.
