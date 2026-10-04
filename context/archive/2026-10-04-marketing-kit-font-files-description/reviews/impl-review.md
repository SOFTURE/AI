# Implementation review: marketing-kit-font-files-description

Scope: full · Date: 2026-10-04 · Commits: 4bb87b7..23f3044 · Gates: typecheck ✓ lint ✓ test ✓ (2518 tests, 29 skipped) · build ✓

## Verdict
Ready. The `brand.fonts.<kind>.files` description now says the files cover weights and styles, that one weight and
style may take several subset files (Fontsource `latin` and `latin-ext`, each with its `unicodeRange`), that the film
picks by `unicodeRange` and OG images try the files in the listed order. `schema/marketing.schema.json` carries the
text for both the `body` and the `heading` font. No findings.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS | - |
| Correctness | PASS | - |
| Tests | PASS (drift and description tests; no behaviour changed) | - |
| Security | PASS (text only) | - |
| Patterns and lessons | PASS (no FIRE font names; one-line `.describe()` like its neighbours) | - |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: The font files description admits subset files | 23f3044 | yes | `grep "one per weight" tools/marketing-kit` finds nothing |

Files: planned and changed 2 · unplanned 0 · planned, not changed 0.

## Correctness notes
- Film: `fontFaces` (`src/compose/compose.ts`) writes one `@font-face` per file with its `unicode-range`, so "picks
  the file of a character by unicodeRange" holds; a file without a range covers all characters, as the
  `unicodeRange` key's own description says.
- OG images: `src/og/fonts.ts` registers later files of a weight and style as `<family> #n` and templates list them
  after the family (`toFontFamilyCss`), so "try the files in the listed order" holds; README §OG images (Fonts) says
  the same and is unchanged.
