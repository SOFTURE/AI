# Implementation review: marketing-kit-og-glyphs

Scope: full · Date: 2026-10-03 · Commits: 026aa20..943275b · Gates: typecheck ✓ lint ✓ test ✓ (2328 passed, 25 skipped) build ✓

## Verdict

Ready. The phase delivers the plan: each font's character map is read at load (refused by JSON
path when unreadable), and `buildOgTree` refuses a card whose texts hold characters none of the
fonts Satori would try maps, naming the image, the JSON path and the characters. Parity with Satori
was checked outside the tests: rendering U+0105 with Satori 0.35 and Inter `latin` 400 alone, with a
second `latin-ext` 400 file in the same family, and with `latin-ext` as another family gives path
data of 727, 727 and 1256 characters: the first two draw the same fallback glyph, only the third
draws the letter, which is exactly what the check reports. One finding was fixed before the commit;
one is accepted.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS | — |
| Correctness | WARN → PASS after fix | F1 |
| Tests | PASS | — |
| Security | PASS | F2 |
| Patterns and lessons | PASS | — |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Character maps and the check | 943275b | yes | `character-map.ts`, `glyphs.ts`, `fonts.ts`, `render.ts`, exports, README, FU-22 |

Files: planned and changed 10 · unplanned 2 (`src/og/character-map.ts` split out of `glyphs.ts`;
`tests/og/helpers.ts` gains `getInterExtFile`) · planned, not changed 0.

## Findings

### F1 [WARNING] A text drawn twice was listed once per drawing, each with every path
**Impact:** LOW · **Dimension:** Correctness · **Where:** `src/og/glyphs.ts` (`findMissingGlyphs`)
**What:** two tiles with the same label produced four error lines (both paths, twice).
**Fix:** `findMissingGlyphs` merges entries by text; tests "lists a text drawn twice once" and the
two-tile render case pin it.
**Decision:** fixed before the commit (943275b).

### F2 [SUGGESTION] Hostile font files
**Impact:** LOW · **Dimension:** Security · **Where:** `src/og/character-map.ts`
**What:** a font comes from the project's own `marketing.json` or a route's own bundle, not from users;
still, every read is bounds-checked and glyphs are looked up on demand, so a huge segment or group
count costs nothing up front and a truncated file is an error value.
**Decision:** accepted as is.

## Notes

- The comparator in `glyphs.ts` is a port of Satori 0.35's; a Satori upgrade that changes font
  selection would show up as a render test (`renders Polish copy when another loaded family
  covers it`, `still refuses it when the covering file is a second file of the same weight`).
- Emoji are checked like any character; no font in the kit has them, so a card with one is refused,
  which the README states.
