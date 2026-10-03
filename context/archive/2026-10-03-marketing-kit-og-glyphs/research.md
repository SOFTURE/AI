# Research: marketing-kit-og-glyphs

Input: change.md, roadmap FU-17, archived MK-5 (`mk-og-images`). Depth: light (one module, no data,
no security surface).
Snapshot: 64a93cd on claude/project-thread-l02pfg, 2026-10-04 01:05 Europe/Warsaw.

## Summary

- Satori 0.35.0 picks a font per character: the families the node asks for first, then every other
  loaded family, taking the first whose `charToGlyphIndex(char)` is not 0; when none has it, the last
  font draws its `.notdef` glyph (`node_modules/satori/dist/index.js`, `getEngine`). So a character
  is missing exactly when **no loaded font** maps it, whatever family the template asked for.
- Satori does not expose its parsed fonts: they live in a module-private cache keyed by the buffer,
  and its `_trackBrokenChars` hook is internal. The only public signal is `loadAdditionalAsset`,
  which runs during layout, receives text segments without any field identity and changes how emoji
  are drawn when set. Not usable for "before layout, with the JSON path".
- Satori parses with `@shuding/opentype.js`, a transitive dependency without types. Importing it
  would depend on a package `package.json` does not list.
- Recommended: read the `cmap` table ourselves. Only the character map is needed (formats 4 and 12
  cover BMP and full-Unicode fonts; 0, 6 and 13 are cheap to add), from `.ttf`/`.otf` (sfnt) and
  `.woff` (sfnt tables, each zlib-compressed when shorter; `node:zlib` inflates them). The test
  font `@fontsource/inter` `latin` `.woff` stores `cmap` compressed (490 of 694 bytes).

## Current state

1. `loadOgFonts` (`tools/marketing-kit/src/og/fonts.ts:89`) reads each brand font file, checks the
   extension and the static weight, and returns `OgFonts { satoriFonts, heading, body }`.
2. `buildOgTree` (`src/og/render.ts:41`) validates `data` against the template's zod schema and
   builds the element tree; error paths are formatted with `formatIssuePath(["data", ...])`.
3. `renderOgSvg` → Satori; `renderOgImage` → resvg; `renderConfiguredOgImage` (`render.ts:111`)
   loads fonts and the logo for one `ogImages` entry and is what `softure-marketing og`
   (`src/cli/og.ts:18`) calls; the CLI prints `png.error` and exits.
4. Text a card draws: the template's string fields (`eyebrow`, `headline`, `cta`, `tiles[].label`,
   `tiles[].value`; chart paths are SVG path data, no text) and `brand.name` (`templates/frame.ts`).
   Templates draw strings as given (no text-transform), so the parsed data is the drawn text.

## Affected surface

| File | Change |
| --- | --- |
| `src/og/fonts.ts` | read each font's character map at load time; refuse an unreadable one by JSON path |
| `src/og/glyphs.ts` (new) | sfnt/WOFF `cmap` reader, coverage check over strings with paths |
| `src/og/render.ts` | check the parsed data and the brand name before building the tree; id in the configured error |
| `src/og/index.ts` | export the check for routes that want it |
| `tests/og/` | reader and check tests (latin vs Polish, latin-ext fallback, emoji, woff and ttf) |
| `README.md` | OG fonts paragraph and the limitation line |

## Options

| Option | For | Against |
| --- | --- | --- |
| A. Own `cmap` reader (chosen) | no new dependency; runs before layout; knows each field's path | ~120 lines of binary parsing to test |
| B. Add `opentype.js` / `fontkit` as a dependency | full parser | a second font parser in the bundle of a Next route for one table; types and versions to track |
| C. Satori `loadAdditionalAsset` | Satori's own decision | during layout, no field identity, changes emoji drawing |

## Open questions, answered

- **Emoji:** treated like any other character: drawn only if a loaded font maps it, otherwise
  refused with the rest. Satori draws no emoji images without `loadAdditionalAsset`/`graphemeImages`,
  which the kit does not set, so a card with an emoji today shows a gap.
- **Characters not checked:** whitespace (`\p{White_Space}`, Satori lays it out as space), control and
  format characters (`\p{Cc}`, `\p{Cf}`: ZWJ, soft hyphen) and variation selectors (U+FE00–U+FE0F,
  U+E0100–U+E01EF): they draw nothing by design.
- **Where the id comes from:** `buildOgTree` has no id; `renderConfiguredOgImage` prefixes the error
  with the entry id and, when the data is the config's, writes the path from `ogImages[<i>]`.

## Constraints and risks

- A font whose `cmap` has no Unicode subtable (symbol fonts) would refuse everything; reported by
  path at load time, which is correct: Satori could not draw text from it either.
- Cost per request in a route: parsing a `cmap` is a few kB; cached per font buffer in a `WeakMap`.
