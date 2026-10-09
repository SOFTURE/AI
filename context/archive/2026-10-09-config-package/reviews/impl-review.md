# Implementation review: config-package

Reviewed: the diff of `claude/project-thread-nno88t` against `plan.md` and issue #327. Verdict: **approved**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `fixtures.exempt` turns `no-restricted-imports` off for the fixtures file, so a fixtures file inside `integration/` also loses the black box rule. | Kept and documented in the README table: the fixtures module is setup code, and the alternative (rebuilding the patterns per exempt file) costs more than it buys. |
| F2 | Suggestion | The default `appSource` (`@/*`) misses relative imports that climb out of `integration/`. | Documented: the app adds relative patterns; a depth-free default cannot tell the tests' own helpers from the app. |
| F3 | Suggestion | The gate's behaviour is unchanged for this repository except the exempt list: the two repo-specific file names are gone, because the files that needed them now sit in `pl/` folders. | Verified: `npm run lint:language` and `tests/repo/language.test.ts` pass on every tracked file. |

Every phase is done; tests were written with the code (the gate's tests moved and still pass, the ESLint and preset
tests are new). Gates: typecheck, lint, test, build green.
