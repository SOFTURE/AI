# Plan review: seo-crawler-access

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 1 critical, 2 warning, 1 suggestion.
Grounding: 14/14 paths (`modules/ops/**`, `templates/package/**`, `foundation/core/src/{module,config}.ts`,
`examples/next-app/{softure.config.ts,next.config.ts,playwright.config.ts}`, `tests/repo/packages.test.ts`,
FIRE files), 6/6 symbols (`defineModule`, `toModuleJson`, `getModule`, `getSoftureConfig`,
`HTML_LIMITED_BOT_UA_RE`, `MetadataRoute.Robots`), 3/3 commands (`workflow.json` gates, `npm run e2e`).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (no data) |
| Tests | WARN (W2) |
| Security | PASS |
| Lean | PASS |
| Fit | PASS |
| Cost and defaults | FAIL (C1) |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS |
| Progress format | PASS |

## Findings

### C1 [CRITICAL] Static metadata routes bake the build-time origin
**Effort:** low. **Lens:** Cost and defaults. **Where:** Phase 2, step 3 · `examples/next-app/playwright.config.ts:44-46`
**Problem:** Next renders `app/robots.ts` and `app/sitemap.ts` at build time unless they use dynamic
APIs. The e2e build (`.github/workflows/e2e.yml`) runs without `APP_ORIGIN`; the server under test
gets it only at start (`webServer.env`). Built statically, robots and sitemap would carry
`http://localhost:3000` and the e2e assertion on `APP_ORIGIN` would fail, and so would any real app
whose origin or contributors are runtime values.
**Fix:** the example's `robots.ts` and `sitemap.ts` declare `export const dynamic = "force-dynamic"`;
the module README says when an app needs it.
**Decision:** Fix now (applied) - phase 2 step 3 rewritten.

### W1 [WARNING] Phase 1's test criterion named a command that does not exist
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, Done when
**Problem:** "`npm test -w @softure-ai/seo`-equivalent": packages have no `test` script; the root
`npm test` runs every package's tests (`vitest.config.mts`).
**Fix:** "the seo tests pass under `npm test`".
**Decision:** Fix now (applied).

### W2 [WARNING] The `htmlLimitedBots` e2e check was not observable as written
**Effort:** low. **Lens:** Tests. **Where:** Phase 2, step 5
**Problem:** "GPTBot gets the `<title>` inside `<head>`" did not say how it is measured.
**Fix:** request a page with GPTBot's user agent and assert `<title>` appears before `</head>` in the
raw HTML; the unit guard covers the list itself.
**Decision:** Fix now (applied).

### S1 [SUGGESTION] Re-export form of metadata routes
**Effort:** low. **Lens:** Fit. **Where:** Phase 2, step 3
**Problem:** Next detects metadata routes by their default export; a bare
`export { robots as default } from "..."` is less certain to be analysed than an imported function
exported as default.
**Fix:** import, then `export default`.
**Decision:** Fix now (applied).

## Triage summary

Fixed: C1, W1, W2, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready after fixes.

## Decisions (auto)

- Every finding fixed in plan.md; none needed an owner decision.
- IndexNow key location re-checked against indexnow.org/documentation (keyLocation may point
  anywhere on the host; a key file covers only URLs under its own directory): the root route holds.
