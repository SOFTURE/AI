# Plan: marketing-kit-og-subset-fonts

Input: change.md, research.md. Complexity: low.

## Goal

A brand font listing several files of one weight and style (Fontsource `latin` + `latin-ext`) draws
every character OG copy needs from those files, at the weight the template asks for:
- `loadOgFonts` registers the n-th file of each (weight, style) group of a family as `<family> #n`
  (n ≥ 2; the first file keeps the family name) and returns the derived names with the family;
- templates write the family as a stack (`Inter, Inter #2`), so a text tries its own family's
  files first, in the brand's order, before any other family;
- the glyph check follows the stack exactly as Satori does and still refuses a character no file
  maps, and now also a character that only a stack file of another weight or style would draw;
- the README states the new rule; the error hint no longer says a second subset file is unused.

**Out of scope:** `unicodeRange` steering (Satori cannot), merging font files, `schema.ts`, the video
renderer (it already uses `unicode-range`).

## Approach

**Starting point:** `loadFamily` (`tools/marketing-kit/src/og/fonts.ts:62`), `text()`
(`src/og/templates/frame.ts:6`), `getCandidateMaps` / `findMissingGlyphs` (`src/og/glyphs.ts:105`,
`:121`), `checkGlyphs` (`src/og/render.ts:66`).

**Chosen:** research option A (derived families per position in a weight-style group, explicit stack).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Derived name | `<family> #<n>`, n = position of the file within its (weight, style) group, from 2 | a Fontsource list gives `#2` all weights, so the fallback stays at the requested weight | research, probe |
| Order | the brand's file order within a group; `#2` before `#3` | the brand controls which subset answers first | research |
| Stack in templates | `OgFontFamily.subsetFamilies: string[]`; `toFontFamilyCss(family)` returns `<family>, <family> #2` unquoted (just `<family>` without subset files) | Satori splits `fontFamily` on commas, trims and tries the named families first; a single-file brand writes the same tree as before | `expand.ts`, `getEngine`, plan review W1 |
| Family names | no new refusal; the glyph check splits `fontFamily` exactly like Satori, so a name with a comma is simulated as Satori draws it | parity, no new failure for configs that render today | plan review W2 |
| Glyph check order | requested names of the stack that are loaded, in stack order, then every family in load order | literal port of `getEngine` | research |
| Off-weight rule | a character whose first drawing file belongs to the requested stack but differs in weight or style from the text's own file (the first requested family's choice) counts as missing | Satori would draw it lighter/heavier silently (probe row 3) | research |
| Error text | "none of the loaded fonts can draw at the text's weight and style"; hint: list a covering file (or subset file) for every weight and style the copy uses | matches the new rule | auto |

## Phase 1: Subset families and the stack

**Discipline:** TDD. **Files:** `src/og/fonts.ts`, `src/og/glyphs.ts`, `src/og/render.ts`,
`src/og/templates/frame.ts`, `src/og/index.ts`, `tests/og/fonts.test.ts`, `tests/og/glyphs.test.ts`,
`tests/og/render.test.ts`, `tests/og/helpers.ts`, `README.md` (marketing-kit).

1. `fonts.ts`: `OgFontFamily` gets `subsetFamilies: string[]`; `loadFamily` counts files per
   `weight + style`, names each `SatoriFont` `family` or `family #n`, collects the derived names in
   order. New `toFontFamilyCss(family: OgFontFamily)`.
2. `templates/frame.ts`: `text()` writes `fontFamily: toFontFamilyCss(family)`.
3. `glyphs.ts`: `TextFontStyle.family` becomes the parsed list (`parseFontFamily`, Satori's split,
   trim, outer-quote strip, lowercase); `getCandidateMaps` returns candidates with their font and
   whether they are requested; `findMissingGlyphs` applies the off-weight rule. The default font
   style keeps `serif`.
4. `render.ts`: error text and hint as above.
5. `index.ts`: export `toFontFamilyCss`.
6. README OG "Fonts": several files of one weight are tried in the listed order (latin then
   latin-ext), each weight needs its own subset files; the Limitations line about FU-23 goes.

**Tests:**
- fonts: Inter latin 400/700 + latin-ext 400/700 → satori names `Inter`, `Inter`, `Inter #2`,
  `Inter #2`, `subsetFamilies` `["Inter #2"]`, `weights` `[400, 700]`; a third file of a weight →
  `Inter #3`; an italic file does not take a subset position of the upright group; `toFontFamilyCss`
  output with and without subset files.
- glyphs: a stack `"Inter", "Inter #2"` maps U+0105 through `#2`; `#2` only at 400 under a 700 text
  → U+0105 reported; another family (not in the stack) at another weight still counts (FU-17
  behaviour); the stack is tried before other families (a body family listed first in load order
  does not answer the heading's character: with the stack, an off-weight `#2` is reported even
  though a loaded-earlier family maps the character at 700); a comma in `fontFamily` is split like Satori.
- render: the `latin` + `latin-ext` brand renders Polish copy at 700 and 400 (a PNG, no error;
  the old "still refuses" test flips); latin-ext only at 400 → refused naming `data.headline`;
  existing snapshots unchanged (single-file brands write the same `fontFamily`).

**Done when:** the tests above pass; gates (typecheck, lint, test, build) are green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Subset families and the stack

#### Automated
- [ ] 1.1 Font, glyph and render tests pass
- [ ] 1.2 Gates green (typecheck, lint, test, build)
