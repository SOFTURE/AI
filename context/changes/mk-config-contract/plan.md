# Plan: mk-config-contract

Input: change.md, research.md, frame.md. Complexity: large (3 phases, one contract and every module that read a constant).

## Goal

- A project describes its films, brand and channels in one `marketing.json`. `loadMarketingConfig`
  validates it with one zod schema and returns a result. Every problem names its JSON path
  (`videos[0].beats[2].id: …`), in English, all problems at once.
- `schema/marketing.schema.json` is generated from the zod schema, shipped in the package, and a test
  fails when it drifts.
- Brand colours resolve from inline values, from the app's stylesheet, or from an Impeccable
  `design.json` (schemaVersion 2), with a per-role mapping of source token names.
- No literal from the research inventory is left in `tools/marketing-kit/src/`, and an architecture
  test checks it.
- `examples/fixture/marketing.json` validates in a unit test and renders through the opt-in render test.

**Out of scope:** declarative actions and per-beat `pad` in JSON (MK-3); the `TtsProvider` interface,
cost estimate and cache migration (MK-7); formats other than 9:16, and a geometry table (MK-6); the
`shots` and `og` commands (MK-4, MK-5; their schema sections are defined here); the release, package
version and `examples/` beyond the fixture (MK-8); any change in FIRE_TRACKER.

## Approach

**Starting point:** a FIRE-shaped `marketing.config.json` (`src/config/config.ts:18-56`), film data and
scene in one TS module (`src/film.ts:59-80`), and 18 literals across `record.ts`, `compose.ts`,
`timeline.ts`, `posts.ts`, `voiceover.ts` and `film.ts` (research inventory).

**Chosen:** one zod schema in `src/config/schema.ts` for the whole file; loading resolves it into a
`MarketingConfig` with absolute paths, resolved brand colours and per-video settings; each pipeline
module takes what it needs as parameters instead of reading a constant. Film data moves into
`videos[]`; the scene stays a TS module named by `videos[].sceneModule` (frame.md, option B).
Rejected: keeping TS films and adding keys for the literals (MK-3 would rewrite the contract);
building formats, actions and the TTS interface here (owned by MK-6, MK-3, MK-7).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| File | `marketing.json`, `--config` default `./marketing.json`; every path resolves against its folder; `$schema` allowed | the contract name in docs/03 | research |
| Top level | strict: `brand`, `app`, `voice`, `videos`, `social?`, `screenshots` (default `[]`), `ogImages` (default `[]`), `sfx` (default `{}`), `output` (default) | the roadmap's sections, plus sounds (inventory #17) | research |
| `brand` | `name`, `locale` (BCP 47, its language needs a dictionary), `timezone` (IANA, checked by constructing `Intl.DateTimeFormat`, because `Intl.supportedValuesOf` omits `UTC`), `logo?: { svg }`, `colors?`, `tokensFrom?`, `fonts?` | inventory #5, #6, #9, #10, #11 | research |
| Colour roles | `background` (#rrggbb), `foreground`, `muted`, `accent`, `cta`, `onCta`, `captionBackground`, `captionText`, `captionHighlight` (#rrggbb or #rrggbbaa) | the nine colours the composition paints; FIRE's `accessible` becomes `cta` | research |
| Colour sources | `tokensFrom: { css \| designJson, theme: light \| dark (default dark), roles?: { <role>: <token> } }`; a role reads the token of the same kebab name unless `roles` names another; inline `colors` win; an unresolved role is an error at `brand.colors.<role>` | answers unknown 1: same-name default, explicit mapping for the rest | research |
| CSS reader | `readCssColors(css, names, theme)` returns a result; `[data-theme="<theme>"]` then `:root`, `var()` resolved; linear comment strip kept | the MK-1 parser without FIRE's token list; MK-1 note 7 | research |
| design.json reader | `readDesignJsonColors(json, names, theme)`: schemaVersion 2, `themes.<theme>.roles` | the shape `@softure-ai/ui` reads; no React dependency | research |
| Fonts | `fonts.{heading,body}?: { family (letters, digits, space, - _), fallback (serif \| sans-serif \| monospace \| system-ui, default sans-serif), files: [{ path, weight (number or "100 900"), style?, unicodeRange? }] }`; files copied to `assets/fonts/<n>-<name>` | FIRE's four variable files fit; families are escaped by shape | research |
| Logo | `<img>` of the copied SVG (`assets/logo.svg`), 60 px high; no logo means the name alone | the logo becomes the project's file | research |
| `app` | `baseUrl`, `port`, `startCommand` (argument array, `{port}`), `colorScheme` (default light), `hideSelectors` (default `[]`), `screenGuardSelector` (default `body`), `device: { viewport: [w, h], scale (1-4), mobile (default true) }` | inventory #2-#4, #7, #8; selectors refuse `{`, `}`, `;`, `<` | research |
| `voice` | `provider` (`elevenlabs`), `voiceId`, `model` (default `eleven_multilingual_v2`), `language` (ISO 639 code), `tempo` (0.8-1.3, default 1), `cacheDir` (default `marketing/voiceover`) | inventory #13, #14; `voiceoverKey(text, voice, model, language)` keeps FIRE's key for `pl` | research, MK-1 note 4 |
| `videos[]` | `id`, `title`, `path`, `format` (`9:16` only), `device?`, `voice?: { voiceId?, model?, tempo? }`, `persona`, `beats` (≥ 3, unique kebab ids), `hook` (shot words in the first sentence), `screenGuard` (non-empty), `endCard`, `sceneModule` (exports `scene`) | answers unknown 2; `validateFilm`'s rules become schema refinements with paths | research, MK-1 note 5 |
| `social` | `linkTemplate` (an URL with `{code}`), `platforms: { <platform>: { code, linkInBio? } }` from instagram, facebook, tiktok, youtube, linkedin, x; `posts: [{ video, caption, hashtags, codes? }]` | inventory #15, #16; labels in the dictionaries | research |
| Channel codes | `^[a-z0-9]+(?:[-_][a-z0-9]+)*$`, at most 32 | `@softure-ai/analytics` default rule, the reader on the receiving app | research, MK-1 note 3 |
| `screenshots[]` | `id`, `path`, `width`, `height`, `full` (default false), `expect`, `motion` (reduce \| no-preference, default reduce), `minBytes` (default 40000) | MK-4's outcome; schema only | frame |
| `ogImages[]` | `id`, `template` (kebab), `size` (default [1200, 630]), `data` (object, default `{}`) | MK-5's outcome; schema only | frame |
| `sfx` | `{ tap?, key?, whoosh?, sparkle?, pop? }` paths; a missing one is silent | inventory #17 | research |
| `output` | `dir` (default `marketing/out`), `buildDir` (default `marketing/build`), `quality` (default standard; `--quality` wins) | the old `paths.out`, `paths.build` | research |
| Errors | one line per issue, `path[0].like.this: message`, all at once; files the pipeline needs (logo, fonts, sfx, scene module) are checked before a recording or render, also by JSON path | the roadmap's "errors name the JSON path" | plan |
| Geometry | `getGeometry(viewport)` returns the 9:16 layout (frame 1080×1920, screen 640 px wide at 220/214, camera target 540/900) for the device; `cameraPose`, `widePose`, `fitScale` and the composition take it; a viewport taller than 2.6× its width is refused | the device is config, the layout table is MK-6 | frame |
| JSON Schema | `z.toJSONSchema(schema, { io: "input" })` written by `scripts/write-schema.ts` (`npm run schema -w @softure-ai/marketing-kit`); a test compares the committed file; `files` ships `schema`, `exports["./marketing.schema.json"]` | no bundler (L-001) | research |
| Architecture test | `tests/architecture.test.ts` greps `src/**/*.ts` (not tests) for the inventory's literals | the roadmap baseline | research |

**Critical details:** the voiceover key for language `pl` must stay `619a27159288f1e1` on the pinned input;
the camera numbers for a 390×844 device must equal today's (timeline and compose tests unchanged in value).

## Phase 1: The contract

**Discipline:** TDD. **Files:** `src/config/schema.ts`, `src/config/brand.ts`, `src/config/css-colors.ts`
(moved from `src/compose/site-tokens.ts` with its test), `src/config/design-json.ts`, `src/config/config.ts`,
`src/config/issues.ts`, `scripts/write-schema.ts`, `schema/marketing.schema.json`, `package.json`, `tsconfig.json`,
`tests/config.test.ts`, `tests/brand.test.ts`, `tests/schema.test.ts`, `examples/fixture/marketing.json`
(written here so the schema test can validate it; phase 3 wires the rest of the fixture).

1. `schema.ts`: `marketingSchema` (zod) with the decisions above; refinements carry `path`.
2. `issues.ts`: `formatIssuePath(path)` (`videos[0].beats[2].id`) and `formatIssues(file, issues)`.
3. `css-colors.ts`: `readCssColors(css, names, theme): { ok: true, colors } | { ok: false, error }`.
4. `design-json.ts`: `readDesignJsonColors(json: unknown, names, theme)`, same result shape.
5. `brand.ts`: `resolveBrandColors(brand, root): { ok, colors } | { ok: false, issues }`.
6. `config.ts`: `loadMarketingConfig(path)` → `{ ok: true, config: MarketingConfig } | { ok: false, error }`;
   `findMissingFiles(config, video)` → issues for logo, fonts, sfx and the scene module.
7. `scripts/write-schema.ts` and the `schema` script; the generated file.

**Tests:** config: paths resolve against the config folder; defaults; `{port}`; unknown key and wrong
type named by path (`app.port`, `videos[0].beats`); locale without a dictionary; a bad timezone;
duplicate beat ids at `videos[0].beats[2].id`; a hook word outside the first sentence; a post for an
unknown video; a channel code the reader would refuse; a viewport that does not fit; all issues at once.
Brand: inline only; CSS source with `roles`; design.json source; inline overrides a source; an
unresolved role names `brand.colors.<role>`; a non-hex value; an 8-digit background refused; the FIRE
stylesheet fixture resolves. CSS reader: the MK-1 cases, now as results. Schema: the committed file
equals the generated one; the fixture config validates.

**Done when:**
- Automated: the tests above pass; gates green (typecheck, lint, test).

## Phase 2: The pipeline reads the contract

**Discipline:** test-after for wiring, TDD for changed pure functions. **Files:** `src/film.ts`,
`src/compose/{timeline,compose}.ts`, `src/render/render.ts`, `src/record/record.ts`, `src/posts/posts.ts`,
`src/voice/voiceover.ts`, `src/messages/{en,pl}.ts`, `src/cli/{main,films,voice,server,options}.ts`,
`src/index.ts`, their tests, `tests/architecture.test.ts`.

1. `film.ts`: `Film` built from a video entry plus its scene (`Scene = (director) => Promise<void>`);
   `validateFilm` removed (schema); `isChannelCode` uses the analytics rule; `PLATFORMS` gains youtube,
   linkedin, x.
2. `timeline.ts`: `Geometry`, `getGeometry(viewport)`; pose functions take the geometry.
3. `compose.ts`: brand colours, fonts (`@font-face` from config), logo `<img>`, caption colours, sound
   files from config, `<html lang>` from the brand locale, geometry from input.
4. `render.ts`: copies the listed font files, the logo and the sound files; no stylesheet parsing.
5. `record.ts`: a `browser` option (viewport, scale, mobile, colour scheme, locale, timezone, hidden
   selectors, screen-guard selector).
6. `posts.ts`: `buildPosts({ title, post, platforms, linkTemplate, messages })`; link from the template.
7. `voiceover.ts`: language as a parameter of `voiceoverKey` and `buildTtsRequest`; FIRE's voice id gone.
8. CLI: `marketing.json`, video ids from the config, the scene module imported, missing files checked
   before record and render, quality from `output`; a video without a `social.posts` entry gets no
   `posts.md` (`all` and `render` say so in one line, `posts` fails with the JSON path to add).
9. `tests/architecture.test.ts`.

**Tests:** timeline: the pinned poses with `getGeometry(390×844)` and one other device; compose: colours,
fonts, logo, sounds and `lang` come from the input; posts: template link, platform subset, link-in-bio
override; voiceover: the pinned key for `pl`, another key for `en`, the request carries the language;
films: a scene module without `scene` is refused; architecture: no inventory literal in `src/`.

**Done when:**
- Automated: the tests above pass; gates green (typecheck, lint, test, build).

## Phase 3: Fixture, docs and the render

**Discipline:** test-after. **Files:** `examples/fixture/{marketing.json,brand/mark.svg,films/fixture-tour.ts,prepare.ts}`
(the old `marketing.config.json` removed), `tests/render.test.ts`, `README.md`, `docs/03-marketing-kit.md`.

1. The fixture as `marketing.json` with a CSS colour source, roles, inline caption colours, a logo, sound
   effects and a scene module.
2. README: the config reference by section, the brand resolution, the FIRE mapping (where each former
   literal goes), limitations left to MK-3…MK-7.
3. docs/03: the contract section points at the schema and README instead of the draft.

**Done when:**
- Automated: the opt-in render test passes locally; gates green (typecheck, lint, test, build).
- Manual: a frame of the draft MP4 shows the logo, the end card and a caption in the configured colours.

## Risks and rollback

- FIRE's voiceover cache orphaned → the pinned-key test stays; the language comes from config only.
- Camera drift from the geometry refactor → value tests unchanged, run with `getGeometry(390×844)`.
- Later items collide in `src/config/` → every section exists now; they add behaviour, not keys.
- Rollback: each phase is one commit; reverting phase 2 and 3 leaves an unused schema, reverting all
  three restores MK-1's config.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The contract

#### Automated
- [ ] 1.1 Config, brand, CSS-reader and schema tests pass
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: The pipeline reads the contract

#### Automated
- [ ] 2.1 Timeline, compose, posts, voiceover, film and architecture tests pass
- [ ] 2.2 Gates green (typecheck, lint, test, build)

### Phase 3: Fixture, docs and the render

#### Automated
- [ ] 3.1 The opt-in render test passes locally
- [ ] 3.2 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 3.3 A frame of the draft MP4 shows the logo, the end card and a caption in the configured colours
