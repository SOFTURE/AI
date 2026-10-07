# Plan: marketing-kit-portrait-templates

Input: change.md, research.md. Complexity: medium (two phases; they share the template registry and the schema).

## Goal

`@softure-ai/marketing-kit` 0.1.8 has two portrait templates, `big-number` and `carousel`, written for 1080×1350 and
scaled by the limiting side; a carousel entry renders `<id>-1.png`…`<id>-N.png` with a "n/N" counter; `size` takes
presets; worst-case copy at the schema's caps stays inside the frame. `headline-cta` and `headline-chart` render
byte for byte as before.

**Out of scope:** FIRE_TRACKER's adoption; new colour or font settings; video or animated slides.

## Key decisions

| Decision | Choice | Source |
| --- | --- | --- |
| Carousel shape | one entry, `data.slides` 2-10 | research §3 |
| Scale | registry `layout`: `landscape` → `width / 1200`, `portrait` → `min(width / 1080, height / 1350)` | research §3 |
| Size | presets `landscape`, `portrait`, `square`, `story` or a tuple; per-template default | research §3 |
| Source line | optional `source` ≤ 80 | research §3 |
| One slide | `slide` (1-based) on `OgImageInput` and `renderConfiguredOgImage`; `countOgSlides(template, data)` | research §3 |
| Overflow oracle | worst-case copy rendered to PNG; padding band must be background | research §4 |
| Version | 0.1.8 | run-wide order |

## Phase 1: Portrait templates and slides in the renderer

**Discipline:** TDD (template tests and the overflow oracle first).
**Files:** `src/og/templates/context.ts`, `templates/portrait.ts` (new: the portrait frame and blocks),
`templates/big-number.ts`, `templates/carousel.ts` (new), `templates/schemas.ts`, `templates/index.ts`,
`src/og/render.ts`, `src/og/index.ts`, `tests/og/*`, snapshots.

1. `OgTemplate.build(data, context, slide)`; the registry gains `layout` and `countSlides(data)` (1 for single cards).
2. `buildOgTree` computes `scale` from the template's layout and takes `input.slide` (default 1); a slide outside
   1…count is refused with the count.
3. `bigNumberDataSchema`, `carouselDataSchema` with caps and `.describe()`; the number's type size steps by length.
4. Portrait frame: logo and name on top (counter on the right for a carousel), content in the middle, `source` and
   `cta` at the bottom.
5. Exports: the schemas, their types, `countOgSlides`.
6. Tests: weights and palette for every template (the existing `it.each`), scale per layout, slide out of range,
   counter text, glyph error path inside a slide, worst-case overflow at portrait/square/story, snapshots
   (`big-number.png`, `carousel.png` = slide 1), old snapshots unchanged.

Done when: gates green; `git diff` shows no change to the two old snapshot PNGs.

## Phase 2: Config, CLI, docs

**Discipline:** TDD for the schema; test-after for the CLI file names.
**Files:** `src/config/schema.ts`, `src/render`-free `src/cli/og.ts`, `src/og/render.ts`
(`renderConfiguredOgImage({ slide })`), `schema/marketing.schema.json`, `examples/fixture/marketing.json`, README,
`package.json`, `package-lock.json`, tests.

1. `size` presets (input) → tuple (output); the new variants default to `portrait`.
2. Uniqueness: an `ogImages` id equal to `<carousel id>-<n>` is refused, naming both.
3. `renderConfiguredOgImage` passes `slide`.
4. CLI `og`: a carousel writes `<id>-<n>.png` for every slide; the log names each file.
5. README: the two templates, presets, the slide option in the route example, the upgrade note; fixture config gets
   one entry of each; JSON Schema regenerated; version 0.1.8.
6. Tests: preset parsing, default per template, the collision refusal, a configured slide equals the direct render;
   `writeOgImages` into a temporary dir writes `<id>.png` and `<id>-1.png`…`<id>-N.png` at the entry size (P3).

Done when: gates green (typecheck, lint, test, build).

## Progress

- [x] Phase 1: portrait templates and slides in the renderer — b039894
- [x] Phase 2: config, CLI, docs — 268498e
