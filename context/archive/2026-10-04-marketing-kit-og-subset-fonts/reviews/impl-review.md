# Implementation review: marketing-kit-og-subset-fonts

Reviewed: commit 7cc1ead against plan.md @ 2026-10-04. Verdict: ready.
Findings: 0 critical, 0 warnings, 2 suggestions.

## Plan conformance
| Plan item | Result |
| --- | --- |
| `loadFamily` registers the n-th file of a weight and style as `<family> #n`, `subsetFamilies` in order | PASS (`src/og/fonts.ts`; tests "registers further files…", "counts subset files per style…") |
| `toFontFamilyCss` unquoted, the family alone without subset files | PASS (template snapshots unchanged) |
| templates write the stack | PASS (`src/og/templates/frame.ts`) |
| glyph check: named families first in stack order, then load order; off-weight rule | PASS (`src/og/glyphs.ts`; tests "draws from the subset families…", "refuses a character only a subset family at another weight maps", "tries the named families before a family loaded earlier") |
| `parseFontFamily` mirrors Satori's `expand.ts` split | PASS (test "splits like Satori") |
| error text and README | PASS (`src/og/render.ts`, README OG "Fonts", Limitations line removed) |
| render: latin + latin-ext at 400 and 700 renders Polish copy; latin-ext only at 400 is refused at 700 | PASS (`tests/og/render.test.ts`) |

## Checks
- Gates: typecheck, lint (ESLint + language), test (whole tree), build: green on 7cc1ead (the only red
  test in the first full run was this change's own roadmap status string, fixed before the commit).
- Parity with Satori 0.35 re-read for: `FontLoader.get` (one file per key), `getEngine` (requested
  faces, then every key), `expand.ts` (comma split, quote strip, lowercase).
- No `any`, no non-null assertion, no lazy regex over CSS; `schema.ts` untouched.

## Findings

### S1 [SUGGESTION] The schema description still says "one per weight and style"
**Where:** `tools/marketing-kit/src/config/schema.ts` (`files` of a brand font), owned by lane E.
**Decision:** Deferred: filed as FU-29 (`marketing-kit-font-files-description`) in roadmap-followups.

### S2 [SUGGESTION] A derived name could collide with a brand family literally named `<family> #2`
**Where:** `getSubsetFamilyName` (`src/og/fonts.ts`).
**Decision:** Dismissed: no real family carries that name; the glyph check would still simulate
whatever Satori draws, so the failure mode is a wrong font, not a missing glyph.
