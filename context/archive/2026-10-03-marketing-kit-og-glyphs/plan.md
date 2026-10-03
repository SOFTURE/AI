# Plan: marketing-kit-og-glyphs

Input: change.md, research.md. Complexity: low.

## Goal

An OG card whose text holds a character no loaded font maps is refused before layout:
- `renderOgImage` / `renderOgSvg` / `buildOgTree` return an error listing each field by JSON path
  (`data.headline`, `data.tiles[0].label`, `brand.name`) with its missing characters, quoted and as
  `U+XXXX`;
- `renderConfiguredOgImage` (and so `softure-marketing og`) names the image id and writes the data
  paths from `ogImages[<i>].data` when the data is the config's;
- a font file without a readable Unicode character map is refused at load by its JSON path.

**Out of scope:** drawing emoji as images, font fallback to system fonts, `schema.ts` changes, making
Satori use a second subset file of the same weight (filed as a followup).

## Approach

**Starting point:** `loadOgFonts` (`src/og/fonts.ts:89`) and `buildOgTree` (`src/og/render.ts:41`).

**Chosen:** an own `cmap` reader (research option A) plus a pure coverage check over the parsed data.
Rejected: a parser dependency (B) and Satori's `loadAdditionalAsset` (C), see research.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Coverage rule | per drawn text node: the font Satori picks for each loaded family at the node's family, weight and style (requested family first); a character passes if one of those maps it | Satori keeps **one** font per family for a weight and style (first loaded wins a tie), then falls back across families | plan review C1 |
| Font selection | a literal port of Satori's weight/style comparator (`kf` in `satori/dist/index.js`) | parity with what Satori draws | plan review C1 |
| Formats | sfnt (`.ttf`, `.otf`, `true`/`OTTO`/`0x00010000`) and WOFF 1; `cmap` formats 0, 4, 6, 12, 13; Unicode subtables only (platform 0, platform 3 encodings 1 and 10) | what Satori reads | research |
| Skipped characters | `\p{White_Space}`, `\p{Cc}`, `\p{Cf}`, variation selectors | draw nothing by design | research |
| Emoji | checked like any character | no emoji images in the kit | research |
| Texts checked | the string children of the built tree with their inherited font style; the JSON path is found by matching the text to the string leaves of the parsed data and `brand.name` (all matching paths listed; otherwise `text "<…>"`) | the tree is exactly what Satori draws | plan review C1 |
| Cache | `WeakMap<Buffer, CharacterMap>` | one parse per font buffer in a route | research |
| Error shape | one message, one line per field, at most 10 characters listed per field then `…` | readable for long copy | auto |

## Phase 1: Character maps and the check

**Discipline:** TDD. **Files:** `src/og/glyphs.ts` (new), `src/og/fonts.ts`, `src/og/render.ts`,
`src/og/index.ts`, `tests/og/glyphs.test.ts` (new), `tests/og/fonts.test.ts`, `tests/og/render.test.ts`,
`README.md`.

1. `src/og/glyphs.ts`:
   - `readCharacterMap(data: Buffer): OgResult<CharacterMap>` with `CharacterMap = { has(codePoint): boolean }`;
     sfnt or WOFF header → table directory → `cmap` (inflate with `inflateSync` when
     `compLength < origLength`) → best Unicode subtable (12/13 over 4/6/0) → ranges. Every read is
     bounds-checked; a malformed file is an `err`, never a throw.
   - `getCharacterMap(data)`: cached wrapper.
   - `findMissingGlyphs(tree: OgNode, fonts: readonly SatoriFont[]): OgResult<MissingGlyphs[]>` with
     `MissingGlyphs = { text; characters: string[] }` (unique, in order of appearance): walks the tree,
     inherits `fontFamily`/`fontWeight`/`fontStyle`, selects fonts as Satori does.
   - `selectSatoriFont(fonts, weight, style)`: the comparator port.
2. `src/og/fonts.ts`: `loadFamily` reads the map after the file; an `err` becomes
   `OG images: <path> (<file>) has no readable character map: <reason>.`
3. `src/og/render.ts`: after `template.build`, `findMissingGlyphs(tree, fonts)`; each text is named by
   the paths of the parsed data's string leaves (and `brand.name`) equal to it; error
   `OG image: template "<t>" has characters none of the loaded fonts can draw:\n  <path>: "\u0105", "\u0119" (U+0105, U+0119)\nUse font files that cover them: OG images use one file per family, weight and style (the first), so a second subset file of the same weight is not used.`
   `buildOgTree` gets an optional `dataPath` prefix (default `data`) so `renderConfiguredOgImage`
   passes `ogImages[<i>].data` when `options.data` is undefined, and prefixes its errors with
   `OG image "<id>": `.
4. `src/og/index.ts`: export `findMissingGlyphs`, `readCharacterMap`, types.
5. README: OG fonts paragraph says what is refused and the one-file-per-weight rule; drop "glyphs
   missing from a font are not detected".
6. Followups: file the gap "a second subset file of the same weight is ignored by OG images" as the
   next free FU (README of `roadmap-followups`, roadmap table and block).

**Tests:**
- glyphs: Inter `latin` woff maps `A`, not U+0105 (a with ogonek); `latin-ext` maps U+0105 (a with ogonek); a `.ttf` built in the test (an
  sfnt with a format 4 and a format 12 `cmap`) is read; truncated buffer / no `cmap` / unknown
  signature → `err`; skipped characters never reported; emoji reported; duplicates once.
- glyphs: the comparator picks like Satori (exact weight, 400↔500, lighter below 400, heavier above
  500, first file wins a tie); a text node inherits the style of its ancestors.
- render: Polish headline with Inter `latin` → error naming `data.headline` and `U+0105`; with
  `latin-ext` as a second file of the same weight → still refused (Satori ignores it); with a
  `latin-ext` body family (`Inter Ext`) → renders (fallback across families); brand name with a missing character →
  `brand.name`; configured image → id and `ogImages[0].data.headline`; existing snapshots unchanged.
- fonts: a `.woff` with garbage bytes is refused with its JSON path.

**Done when:** the tests above pass, gates (typecheck, lint, test, build) are green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Character maps and the check

#### Automated
- [x] 1.1 Glyph, font and render tests pass — 943275b
- [x] 1.2 Gates green (typecheck, lint, test, build) — 943275b
