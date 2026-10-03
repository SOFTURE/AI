# Implementation review: mk-og-images

Reviewed: branch `claude/project-thread-of0rsf` against plan.md @ 2026-10-03. Mode: standard.
Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 2 suggestions (all resolved below).

## Plan conformance

| Plan item | Result |
| --- | --- |
| `og [image]` writes `<output.dir>/og/<id>.png` at the entry's size | done: `src/cli/og.ts`; checked by hand on a copy of the fixture (1200×630 and 1080×1080) |
| `headline-cta` and `headline-chart` with zod data schemas; `ogImages` a union on `template` | done: `src/og/templates/schemas.ts`, `src/config/schema.ts`; the JSON Schema regenerated, the drift test green |
| Fonts, palette, logo and name from the brand; only loaded weights | done: `src/og/fonts.ts` (`pickWeight`), `src/og/palette.ts`, `src/og/templates/frame.ts`; tested per template with Inter 400+700 and with 400 alone |
| `.woff2` and variable ranges refused by JSON path | done, tested (`tests/og/fonts.test.ts`) |
| `@softure-ai/marketing-kit/og` without Playwright; thin Next route | done: `package.json` export, `src/og/index.ts`; a test walks the run-time imports of the entry; README shows the route |
| A route's `data` override goes through the template schema (plan review W2) | done, tested |
| Alpha derivations for every hex spelling (plan review W1) | done, tested |
| A PNG snapshot per template | done: `tests/og/__snapshots__/*.png`, byte equality, refreshed only with `UPDATE_OG_SNAPSHOTS=1`; a missing or extra snapshot fails |

## Findings

### W1 [WARNING] A test file imported another test file
**Where:** `tests/og/render.test.ts` (first draft) imported `SAMPLE_DATA` from `templates.test.ts`.
**Problem:** importing a test file registers its suites a second time in the importer, so the template
tests ran twice and a failure would be reported in two files.
**Fix:** `SAMPLE_DATA` moved to `tests/og/helpers.ts`. **Status:** fixed.

### S1 [SUGGESTION] Next may try to bundle the native rasteriser
**Where:** README, OG images.
**Problem:** `@resvg/resvg-js` loads a `.node` binary; a bundler that follows it fails the route build.
**Fix:** the README names `serverExternalPackages` and `runtime = "nodejs"`. **Status:** fixed.

### S2 [SUGGESTION] Long headlines can crowd the chart card
**Where:** `src/og/templates/headline-chart.ts`.
**Problem:** a 90-character headline in the half-width column wraps to four lines at 52 px; with three
tiles the column is taller than the card's content area.
**Decision:** kept. The limits are validated, the smallest headline size applies to long copy, and the
square format has room; a per-template line clamp is a template refinement, not needed for FIRE's cards.

## Gates

See the Progress section of plan.md for the commits; typecheck, lint (ESLint + language gate), test
and build ran green before the push.

## Gaps sent to followups

- FU-17 `marketing-kit-og-glyphs`: glyphs missing from a subset font are not detected (Satori draws
  nothing without an error).
