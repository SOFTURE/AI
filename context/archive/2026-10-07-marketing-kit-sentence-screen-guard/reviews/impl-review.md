---
change_id: marketing-kit-sentence-screen-guard
reviewed: 8dda1ad..cfc10ae
date: 2026-10-07
verdict: approved
---

# Implementation review: marketing-kit-sentence-screen-guard

Checked the diff against `plan.md` and the issue, then recorded the fixture's films in a real browser.

## Verification

The fixture staged with `prepareFixture` into a temporary folder, `softure-marketing record` run with Playwright's
Chromium:

| run | result |
| --- | --- |
| `fixture-tour` (scene module), `fixture-tour-actions` (JSON scene), `fixture-desktop` (16:9 desktop), each with `"49 years"` on the video and `"March 2040"` on the last sentence | exit 0, `screen guard passed`; the module and JSON recordings write equal logs |
| JSON film, last sentence's phrase changed to one the screen never shows | exit 2: `Sentence "cta" ended without its screenGuard phrases on screen: missing "April 2041". …` |
| same phrase moved to the sentence holding the `checkScreen` | exit 2 at that action: `videos[1].beats[1].actions[9] (checkScreen): The screen does not say what the voiceover says: missing "April 2041". …` |

The helper tests (`src/record/screen-guard.test.ts`) and the schema tests (`tests/actions-schema.test.ts`, a
sentence's own screen guard) failed before the code and pass with it. Gates: `npm run typecheck`, `npm run lint`,
`npm test` (319 files passed, 6 skipped) green. Part 1 of the issue needed no code: `--placeholder` (0.1.8) is the
rehearsal it asks for; the README now says so where an author looks before paying, and in "Upgrading to 0.1.9".

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | A `checkScreen` a scene module calls between two sentences re-checks the previous sentence's phrases (the recorder keeps the last sentence as current, as before). | Accepted: it only checks more, never less, and JSON scenes cannot place an action between sentences. |
| 2 | Suggestion | A sentence-end failure carries no JSON path, unlike an action's. | Accepted (plan review finding 1): the message names the sentence and the config file. |

No open blocking finding.
