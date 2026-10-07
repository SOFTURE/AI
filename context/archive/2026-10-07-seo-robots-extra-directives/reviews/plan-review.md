# Plan review: seo-robots-extra-directives

Reviewed: `plan.md` against `change.md`, issue #194 and the current sources of `modules/seo/src/robots.ts`,
`src/options.ts`, `src/server/indexnow.ts` and the seo tests. Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | The first draft wrote `other` only into the `*` group and the named group. A crawler of a switched-off category has its own group and would never see the line, while the adopting app writes it in every group. | Fixed in the plan: D1 copies the map into every group, the blocked one included; the Phase 1 test asserts all three groups. |
| F2 | Warning | Next writes `other` values verbatim. A value with a newline from a config read from the environment would add arbitrary lines (e.g. `Allow: /`) to `robots.txt`. | Fixed in the plan: D3 refuses CR and LF in values and the module's own field names as keys; tests cover both. |
| F3 | Suggestion | A typed `contentSignal: { aiTrain, search, aiInput }` option would catch typos in the signal names. | Kept the generic map: the Content Signals vocabulary is still moving and the issue's first suggestion is the map; a typo shows in the app's own production check. |
| F4 | Suggestion | `Crawl-delay` or `Host` could also be set through the map. | Accepted: they are group-level lines an app may want; only the fields the module writes itself are refused. |

No migration, no cross-package contract, no hot file shared with another open change.
