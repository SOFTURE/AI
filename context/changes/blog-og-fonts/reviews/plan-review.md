# Plan review: blog-og-fonts

Reviewed: plan.md @ 2026-10-05. Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 9/9 paths, 5/5 symbols (`renderArticleOgImage`, `BlogArticleOgImage`, `OgFont`, `brandSchema`,
`getBlogOptions`), 1/1 commands (gates from `workflow.json`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (name, weight, path or URL, read once and cached, a missing file named; marketing-kit's files as a source in the README) |
| Slicing | PASS (one phase: the option is useless without the loader and the card) |
| Verifiability | PASS (each roadmap clause has a test; the card is rendered, not only its inputs) |
| Data and migrations | PASS (none) |
| Tests | PASS (empty list, a bad weight, a missing file, a non-font answer, a non-2xx answer, read once) |
| Security | PASS after S1 (`https` only for URLs; sources come from the app's own config, never from a request) |
| Lean | PASS (one new file; no dependency on marketing-kit) |
| Fit | PASS after W1 |
| Cost and defaults | PASS (without `brand.fonts` the card is byte for byte as today) |
| Scope | PASS (the HTML pages and the gate untouched) |
| Reuse | PASS (`renderArticleOgImage({ fonts })` kept as the seam; marketing-kit's format knowledge reused, not its code) |
| Lessons | PASS (no lazy regex over user input; the language gate) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The loader needs the Node runtime, and the plan does not say so
**Effort:** low. **Lens:** Fit. **Where:** Phase 1, step 3 (plan.md)
**Problem:** a path source is read with `node:fs/promises`. An app that sets `export const runtime = "edge"` in
its `opengraph-image.tsx` would fail on the first card with a module error that names neither the option nor
the cause. Next's default runtime for a route is Node, and the documented re-export does not set one.
**Fix:** say in the README and in the card's header comment that the card runs on the Node.js runtime (the
default) and that an `https` URL is the only form for an app that moves it.
**Decision:** Fix now (applied) - added to steps 4 and 5 below.

### S1 [SUGGESTION] Check the `.woff2` ending on a URL's path, not on the whole string
**Effort:** low. **Lens:** Security. **Where:** Key decisions, `src` forms (plan.md)
**Problem:** `https://cdn.example.com/inter.woff2?v=3` ends with `?v=3`; a plain `endsWith(".woff2")` lets it
through to the loader, where the signature check refuses it only on the first card.
**Fix:** for a URL, test the parsed `pathname`; for a path, the string itself.
**Decision:** Fix now (applied) - step 2 below.

## Triage summary
W1 and S1 applied to plan.md before implementation.
