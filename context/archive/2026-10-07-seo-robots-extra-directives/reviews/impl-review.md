# Implementation review: seo-robots-extra-directives

Reviewed: the branch diff against `plan.md` (D1–D6), issue #194 and Next's robots serializer
(`next/dist/esm/build/webpack/loaders/metadata/resolve-route-data.js`, `resolveRobots`). Verdict: **approved**.

## Plan conformance

| Decision | Where | Status |
|---|---|---|
| D1 `robots.other` in every group, the closed one too | `src/options.ts`, `src/robots.ts` | done; `tests/robots.test.ts` asserts three groups with training off |
| D2 no `other` key without entries | `src/robots.ts` (`extra` spread only when the map has keys) | done; existing `toEqual` tests unchanged and green |
| D3 names and values validated at start-up | `src/options.ts` (`directivesSchema`) | done; `tests/module.test.ts` lists nine refusals in one error |
| D4 `RobotsRule.other` | `src/robots.ts` | done, same shape as Next's `MetadataRoute.Robots` rule |
| D5 signing fetch documented | `src/server/indexnow.ts` JSDoc, README § Mounting | done |
| D6 CHANGELOG and version 0.1.6 | `CHANGELOG.md`, `package.json`, `module.json`, `src/index.ts`, `package-lock.json` | done |

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Warning | Zod skips a `superRefine` when an earlier check of the same value failed, so the first run reported value errors only and hid a bad name until the next start-up. | Fixed: the name check runs with `when` whenever the value is an object; the test asserts value and name errors in one message. |
| R2 | Suggestion | `buildRobots` puts the same `other` object reference into every group. | Fixed before review: `copyDirectives` copies the map (and its lists) once and the groups share that copy, which the module never mutates; the settings object stays untouched. |
| R3 | Suggestion | A value starting with `#` would make the whole line a comment in some parsers. | Accepted as is: an app writing `#…` sees it in its own `robots.txt`; it cannot add or open a path. |
| R4 | Suggestion | Files touched here named the app the rules came from. | Fixed: neutral wording in `src/robots.ts`, `tests/robots.test.ts` and the README. |

## Tests

New tests were seen red first (6 failing: unknown option key, no `other` in groups), then green. Gates: see the PR
(typecheck, lint, `npm test`, build).
