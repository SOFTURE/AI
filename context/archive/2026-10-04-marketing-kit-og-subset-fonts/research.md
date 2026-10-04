# Research: marketing-kit-og-subset-fonts

Input: change.md (FU-23). Sources: Satori 0.35.0 (`node_modules/satori/dist/index.js.map`,
`src/font.ts`, `src/handler/expand.ts`), `tools/marketing-kit/src/og/`, a throwaway render with
`@fontsource/inter` files. Date: 2026-10-04.

## How Satori 0.35 picks a font

- `FontLoader.addFonts` keys every file by `${name.toLowerCase()}_${lang ?? "unknown"}`; files of
  one key form a list in load order.
- `FontLoader.get({ name, weight, style })` returns **one** file of a key: the comparator
  (`compareFont`) keeps the first file on a full tie. Two files of one family, weight and style:
  the second is never used.
- `getEngine` builds the candidate list for a text run: first one file per family named in
  `fontFamily` (in the order written), then one file per loaded key in load order (the requested
  keys come again; harmless). Per grapheme, the first candidate whose `charToGlyphIndex` is not 0
  draws it; with none, the last candidate draws `.notdef`.
- `fontFamily` is a CSS string: `expand.ts` splits it on `,`, trims, strips surrounding quotes and
  lowercases each name. A stack `"Inter", "Inter #2"` reaches `getEngine` as two names.
- No `unicode-range` support: Satori decides by the character map alone.

## Answers to the item's unknowns

| Unknown | Answer | Evidence |
| --- | --- | --- |
| Derived family names vs. merging | Derived names. Merging two font files (glyf/CFF, hmtx, cmap, GSUB/GPOS) is a font compiler's job and a heavy dependency; derived names need no new code beyond registration and the stack. | `get` keeps one file per key; fallback walks keys |
| Order Satori tries them in | The `fontFamily` stack order, then every key in load order. Fallback by load order alone would let another brand family (the body font) answer before the heading's own `latin-ext` file, so the template must name the stack explicitly. | `getEngine` (`fonts` before `additionalFonts`) |
| Whether `unicodeRange` steers the choice | No. Satori has no hook for it; the files are tried in the order the brand lists them, and a character goes to the first file that maps it. Subset files of one design cover disjoint ranges in practice (Fontsource), so the result matches the browser's. | no `unicode` handling in `font.ts` |

## Probe

Throwaway render of U+0105 U+0119 (a and e with ogonek) at weight 700 (length of the drawn path data):

| Fonts | Result |
| --- | --- |
| `Inter` latin 400/700 + latin-ext 400/700, one family | 5265, identical to latin alone (`.notdef` boxes) |
| latin-ext 400/700 as `Inter #2`, `fontFamily: "Inter, 'Inter #2'"` | 4639: real glyphs |
| only latin-ext 400 as `Inter #2` | 4633: real glyphs, but at 400 in 700 text |

The last row is the remaining trap: when a derived family lacks the requested weight, Satori takes
its nearest weight, so the letters silently come out lighter or heavier than the rest of the line.

## Options

- **A. Derived families per position in a weight-style group (recommended).** The n-th file of each
  (weight, style) group is registered as `<family> #n` (n ≥ 2); the first keeps the family name.
  A Fontsource list (latin + latin-ext per weight) gives `#2` every weight, so every character is
  drawn at the requested weight. Templates write the stack (`family, "family #2", …`). The glyph
  check follows the stack like Satori and refuses a character whose first drawing file is a stack
  member at another weight or style than the text's own file.
- **B. Refuse uneven groups at load.** Simpler check, but refuses configs that never need the odd
  file (italic only at one weight, which templates never draw) and that worked before.
- **C. Merge files.** Rejected: needs a font compiler.

## Constraints and risks

- The stack needs family names Satori's splitter keeps intact: a brand family with a comma or a
  quote would break it (it already would today in CSS); derived names add only ` #n`.
- The glyph check's comparator port and candidate order must stay in step with Satori upgrades
  (already true since FU-17; the tests pin it).
