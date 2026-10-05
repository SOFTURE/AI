# Plan review: blog-seo-canonical

Reviewed: plan.md @ 2026-10-05. Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 19/19 paths, 8/8 symbols (`getAbsoluteUrl`, `getJsonLdContext`, `JsonLdContext`, `buildBlogRss`,
`resolveSeoSettings`, `buildCanonicalUrl`, `findSwitchReader`, `defineModule`), 1/1 commands (gates from
`workflow.json`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (canonical, OG, JSON-LD and feed; the fallback keeps today's output) |
| Slicing | PASS (one phase: the contract is useless without a provider and a consumer) |
| Verifiability | PASS after W1 |
| Data and migrations | PASS (none) |
| Tests | PASS (a canonical host that differs from `appOrigin` and `trailingSlash: true`, as the roadmap asks) |
| Security | PASS (paths come from validated routes; the fallback refuses a path that is not on the site) |
| Lean | PASS (one small core file, one provider, the blog's URL builders take one object) |
| Fit | PASS (the switch-reader contract's shape, validation and older-module check) |
| Cost and defaults | PASS (without seo nothing changes) |
| Scope | PASS after S1 |
| Reuse | PASS (`resolveSeoSettings`, `buildCanonicalUrl`) |
| Lessons | PASS (L-001 not touched; the blog-discovery lesson on lazy imports applied) |
| Progress format | PASS |

## Findings

### W1 [WARNING] Nothing guards the "no seo import from the blog's Next code" constraint
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, Done when (plan.md)
**Problem:** the whole reason for the contract is that `@softure-ai/blog/next` must not reach seo. The existing
architecture test only forbids a static `import … from "@softure-ai/seo"`; a later change could add a dynamic
import in `src/next/` or `src/pages/` and every test would stay green, while an app without seo would fail to build.
**Fix:** extend `modules/blog/tests/architecture.test.ts`: `src/next/`, `src/pages/` and `src/ui/` contain no
`"@softure-ai/seo"` specifier at all and do not import `discovery/submit`.
**Decision:** Fix now (applied) - added to step 4 and to Done-when 1.3 below.

### S1 [SUGGESTION] Record the internal-link host lists as a gap
**Effort:** low. **Lens:** Scope. **Where:** Decisions (auto) (plan.md)
**Problem:** with a canonical host other than `appOrigin`, a body link to the canonical host is marked external
(`pages/body.ts` `siteHosts`) and the quality gate reports it as an external link (`ownOrigins`). Out of this
item's outcome and partly in lane C.
**Fix:** file it as the next `BF-<n>` in the catch-all, not fix it here.
**Decision:** Fix now (applied) - a gap entry is part of Phase 1's files.

## Triage summary
W1 and S1 applied to plan.md before implementation.
