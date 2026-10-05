# Plan review: blog-canonical-host-links

Reviewed: plan.md @ 2026-10-05. Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 0 suggestions.
Grounding: 7/7 paths, 6/6 symbols (`renderPageBody`, `RenderPageBodyOptions`, `getBodyOptions`,
`resolveQualitySettings`, `getQualitySettings`, `getSiteUrls`), 1/1 commands (gates from `workflow.json`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (both lists the roadmap names; without seo the lists are unchanged) |
| Slicing | PASS (one phase) |
| Verifiability | PASS after W1 |
| Data and migrations | PASS (none) |
| Tests | PASS (a canonical host that differs from `appOrigin`, as the roadmap asks) |
| Security | PASS (fewer links get `noopener` only for the site's own host; the gate's origin list comes from the validated seo options) |
| Lean | PASS (two call sites pass one more origin) |
| Fit | PASS (`getSiteUrls` from core, as BF-7 left it; no seo import in `src/next/` or `src/pages/`) |
| Cost and defaults | PASS (without seo `getSiteUrls(config).origin` is `appOrigin`) |
| Scope | PASS |
| Reuse | PASS (`getSiteUrls`) |
| Lessons | PASS |
| Progress format | PASS |

## Findings

### W1 [WARNING] The article page test in the seo suite asserts the page holds no `app.example.com`
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, step 1 (plan.md)
**Problem:** "puts the same canonical URL in the article's JSON-LD" renders `index-funds` and expects no
`app.example.com` in the HTML. Adding a body link to `appOrigin` to that article (to show it stays internal)
would break an unrelated assertion, or tempt a change to it.
**Fix:** publish a separate article in the new test, with links to the canonical host, to `appOrigin` and to an
unrelated host, and render that one; the gate test proves the canonical origin is internal by an
`internal-link-target` finding on a path that does not exist (an internal link is resolved, an external one is not).
**Decision:** Fix now (applied) - step 1 of the plan carries it in the implementation.

## Triage summary
W1 applied before implementation.
