# Plan: mk-og-images

Input: change.md, research.md. Complexity: small (2 phases, one new directory and its CLI wiring).

## Goal

- `softure-marketing og [id]` renders every `ogImages` entry (or the one named) to
  `<output.dir>/og/<id>.png` at the entry's `size`, 1200×630 by default.
- Two templates: `headline-cta` (eyebrow, headline, CTA, up to four tiles) and `headline-chart`
  (eyebrow, headline, a precomputed chart as SVG paths in a view box, up to three tiles). Each
  template's `data` is a zod strict object; `ogImages` becomes a union on `template`, so the JSON
  Schema documents each template's data and a wrong field names its JSON path.
- Fonts come from `brand.fonts` (heading and body; body falls back to heading and back), palette from
  the brand's colour roles, the logo and name from the brand. Only loaded weights appear in a tree.
- A Next route stays thin: `@softure-ai/marketing-kit/og` exports `renderOgImage` and
  `renderConfiguredOgImage({ config, id, data? })` without loading Playwright; README shows the route.

**Out of scope:** pixel parity with FIRE's current PNGs (FIRE checks it when it adopts the package);
detecting glyphs missing from a font subset (gap for followups); templates beyond the two above;
anything in `src/record/`, `src/screenshot/`, `src/compose/`, `src/render/`.

## Approach

**Chosen:** option A from research.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Elements | plain `{ type, props: { style, children } }` built by a small `h()` helper, `.ts` only | no React or JSX config in the kit | research |
| Result shape | `{ ok: true, value } \| { ok: false, error: string }` as in `voice/` | kit convention (MK-7) | plan |
| Font files | `.ttf`, `.otf`, `.woff` with a numeric weight; `.woff2` and ranges are errors naming `brand.fonts.<kind>.files.<i>` | Satori cannot parse them / cannot honour a weight | research |
| Weight choice | template asks for a wish (e.g. 700); `pickWeight(loaded, wish)` returns the nearest loaded weight (ties go heavier) | only loaded weights by construction | research |
| No fonts | error "OG images need at least one .ttf, .otf or .woff font in brand.fonts" | Satori needs a font for layout | research |
| Palette | `getOgPalette(colors)`: background, foreground, muted, accent, cta, onCta from the roles; `surface` = foreground at 8 % alpha, `border` = foreground at 16 % alpha (hex8, from the colour normalised to `#rrggbb` first, so `#rgb`, `#rgba` and `#rrggbbaa` roles work) | derived from the brand only; no literal colours in `src/og/` | roadmap, plan review W1 |
| Chart | `chart: { viewBox: [w, h], paths: [{ d, tone, fill? }] }`; `tone` is a palette role (`accent \| cta \| foreground \| muted`); `d` restricted to SVG path characters | app computes, template only draws; no markup injection | roadmap |
| Scale | sizes in templates are multiples of `width / 1200` | any `size` keeps proportions | plan |
| Text limits | eyebrow ≤ 40, headline ≤ 90, CTA ≤ 32, tile label ≤ 24, value ≤ 16 characters | a card has room for that; longer copy overflows silently | plan |
| Output | `<output.dir>/og/<id>.png`; the CLI prints `✓ <path> (<w>×<h>, <template>)` | next to the films, not committed | plan |
| Rasteriser | `@resvg/resvg-js` with `loadSystemFonts: false`, `fitTo: original` | deterministic: no machine fonts | research |
| Snapshot | one committed PNG per template under `tests/og/__snapshots__/`, compared byte for byte; written only with `UPDATE_OG_SNAPSHOTS=1`, a missing file fails | roadmap baseline: a PNG snapshot per template | roadmap |
| Entry point | `src/og/index.ts` exported as `./og` (source → types → default, as the package test requires) | a Next route without Playwright | research |
| CLI shape | `og` takes an optional id; the film positional stays required for the other commands | `og` is not about a film | plan |

**Critical details:** `src/og/` must not import `src/record/` or Playwright; every font weight in every
template tree is loaded (tested); a `.woff2` brand font is refused before rendering, never silently.

## Phase 1: Templates, fonts, palette and renderer

**Discipline:** TDD. **Files:** `src/og/{element,fonts,palette,render,index}.ts`,
`src/og/templates/{frame,headline-cta,headline-chart,index}.ts`, tests in `tests/og/`,
`src/config/schema.ts` (the `ogImages` union), `schema/marketing.schema.json` (regenerated).

1. `element.ts`: `OgNode`, `h(type, props, children)`.
2. `palette.ts`: `getOgPalette(colors)`.
3. `fonts.ts`: `loadOgFonts(fonts, readFile?)` → result `{ satoriFonts, heading: { family, weights }, body }`; `pickWeight`.
4. Templates: data schemas, `build(context)`; registry `OG_TEMPLATES` + `OG_TEMPLATE_IDS`.
5. `render.ts`: `buildOgTree(input)` (validates data) and `renderOgImage(input)` → PNG result;
   `renderConfiguredOgImage({ config, id, data? })` reads the logo, loads fonts, renders; a `data`
   override (a route's live values) goes through the same template schema as the config's data (plan review W2).
6. Schema: `ogImageSchema` = discriminated union on `template` with each template's `data`; regenerate.

**Tests:** palette: every role from the brand, alpha derivations exact for `#rgb`, `#rrggbb` and `#rrggbbaa`; fonts: woff loaded with its
weight, woff2 and a range refused with the path, no fonts refused, `pickWeight` nearest and ties;
templates: every tree's font weights are loaded weights (heading only 400 → headline uses 400), tile
and text limits refused by the schema with paths, a chart path with markup refused, unknown template
refused by the config loader, an invalid `data` override refused by `renderConfiguredOgImage`; renderer: PNG signature and exact size for the default and a custom
size; snapshot per template (byte equality); `renderConfiguredOgImage` with a `data` override; an
unknown id is an error; `src/og/` imports no Playwright (architecture-style check).

**Done when:**
- Automated: the tests above pass; schema drift test green; gates green (typecheck, lint, test).

## Phase 2: CLI command, exports and docs

**Discipline:** test-after. **Files:** `src/cli/og.ts`, `src/cli/options.ts`, `src/cli/main.ts`,
`src/index.ts`, `package.json` (`./og` export), `README.md`, `docs/03-marketing-kit.md` (license rows).

1. `options.ts`: `og` command, optional id; usage line.
2. `cli/og.ts`: `writeOgImages(config, id?)` writes the files, maps errors to `fail`.
3. `main.ts`: `og` dispatched before a film is loaded.
4. `index.ts` + `./og` export; README "OG images" with the thin Next route; docs license rows for
   satori and resvg-js.

**Tests:** options: `og` without an id, with an id, flags refused the same way.

**Done when:**
- Automated: gates green (typecheck, lint, test, build).
- Manual: `softure-marketing og` on a temp copy of the fixture with Inter fonts writes the PNGs and the
  image looks right (inspected).

## Risks and rollback

- resvg build differences break the byte snapshot → pinned version range; updating is one env var.
- Merge collisions with MK-3/MK-4/MK-6 in `schema.ts`, `options.ts`, `main.ts`, `index.ts` → small
  edits; master wins, re-apply, regenerate the JSON Schema.
- Rollback: revert the commits; `ogImages` goes back to the contract-only shape.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Templates, fonts, palette and renderer

#### Automated
- [ ] 1.1 Palette, font, template, renderer and snapshot tests pass
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: CLI command, exports and docs

#### Automated
- [ ] 2.1 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 2.2 `softure-marketing og` writes the fixture's PNGs and they look right
