# Research: mk-config-contract

Input: change.md, roadmap MK-2, research.sources (`docs/03-marketing-kit.md`; FIRE_TRACKER is not
checked out in this session, so FIRE facts come from the MK-1 port and its archive). Depth: normal (no
data, no money; the risk is a contract every later item builds on). Snapshot: 7c20fec on
claude/project-thread-xaujo8 (master after PR #34), 2026-10-03 18:52 Europe/Warsaw.

## Summary

- The package reads one FIRE-shaped `marketing.config.json` (`tools/marketing-kit/src/config/config.ts:18-56`)
  and one TS module per film that mixes data and the scene (`src/film.ts:59-80`). The new contract
  replaces both data sources with `marketing.json`; only the scene stays code until MK-3.
- 18 product-specific literals remain in `src/` (inventory below), in five files: `record.ts`,
  `compose.ts`, `timeline.ts`, `posts.ts`, `voiceover.ts`, plus `film.ts` (platforms, channel rule).
- Colours come from the app's stylesheet through a fixed FIRE token list (`site-tokens.ts:16-27`);
  the composition uses six of them (`compose.ts:272-321`) and three more colours are literals.
- `@softure-ai/ui` already parses Impeccable `design.json` (schemaVersion 2, `themes.{light,dark}.roles`,
  `foundation/ui/src/theme/design-json.ts:46-71`), but maps roles onto UI tokens and drops the rest, so
  the kit cannot reuse its output; the shape is the reference.
- The geometry constants (`timeline.ts:11-17`) are module-level and read by `timeline.ts`, `compose.ts`
  and `record.ts`; a configurable device means passing a geometry value through those functions.
- `z.toJSONSchema` is available (zod 4.6.5, `node -e` check), so the JSON Schema can be generated from
  the zod schema and guarded against drift by a test.
- No SOFTURE module covers this. The channel-code rule overlaps `@softure-ai/analytics`.

## Current state

- **Config** (`config.ts:18-56`): strict zod object with `locale` (`pl`/`en`), `brand.name`,
  `app.{baseUrl,path,port,startCommand}`, `siteCss`, `posts.site`, `paths.{films,voiceover,build,out,fonts,sfx}`;
  errors are `path.join(".")` lines (`config.ts:79-82`), e.g. `videos.0.beats`, not `videos[0].beats`.
  Loading returns a result (`config.ts:85-129`).
- **Film** (`film.ts:59-80`): `id`, `title`, `persona`, `voice {voiceId, modelId, tempo}`, `beats`,
  `hook`, `screenGuard`, `channels: Record<Platform,string>`, `endCard`, `post`, `scene(director)`.
  Every field except `scene` is plain data (strings, numbers, arrays). `validateFilm` (`film.ts:127-165`)
  throws one joined message. Films load through `tsImport` (`cli/films.ts:24-33`).
- **Recording** (`record/record.ts:93-116`): viewport from `VIEWPORT`, `deviceScaleFactor: 3`,
  `isMobile`, `hasTouch`, `colorScheme: "dark"`, `locale: "pl-PL"`, `timezoneId: "Europe/Warsaw"`; a
  style tag hides `nextjs-portal` and FIRE's `[data-testid=lista-przyklejona]`; the screen guard reads
  `page.locator("main")` (`record.ts:312`).
- **Composition** (`compose/compose.ts`): `<html lang>` from `locale` (260); four `@font-face` rules for
  FIRE's Geist and Newsreader files (267-270); caption pill background `rgba(236,241,247,.97)` (285) and
  highlight `#059669` (37, 343); the end card's FIRE logo as inline SVG coloured by `locked`,
  `accessible`, `muted`, `background` (321); the URL pill and avatar use `accessible` (289, 295); the
  touch ring uses `accent` (283); sound effects are five fixed file names (226-232).
- **Geometry** (`compose/timeline.ts:11-17`): `FRAME` 1080×1920, `VIEWPORT` 390×844, `SCREEN`
  {220, 214, 640}, `CAMERA_TARGET` {540, 900}; `cameraPose`, `widePose`, `fitScale` read them
  (`timeline.ts:38-62`); `compose.ts` reads `FRAME`, `SCREEN`, `SCREEN_HEIGHT`, `SCREEN_SCALE`;
  `record.ts` reads `VIEWPORT` (95, 189, 285).
- **Voice** (`voice/voiceover.ts`): `ELEVENLABS_DEFAULT_VOICE` is FIRE's narrator (16), language `"pl"`
  fixed and part of the key (22, 58) and of the request (70); a test pins `619a27159288f1e1`
  (`voiceover.test.ts:24-29`).
- **Posts** (`posts/posts.ts`): `channelLink` appends `?z=` (25); `LINK_IN_BIO` per platform (12-16);
  three platforms from `film.ts:10`.

### Literal inventory (the architecture test's deny list)

| # | Literal | Where | Contract key |
| --- | --- | --- | --- |
| 1 | `marketing.config.json` | `config.ts:14` | default `marketing.json` |
| 2 | 390×844 viewport | `timeline.ts:12` | device viewport |
| 3 | `deviceScaleFactor: 3`, `isMobile` | `record.ts:96-97` | device scale, mobile |
| 4 | `colorScheme: "dark"` | `record.ts:99` | app colour scheme |
| 5 | `pl-PL` | `record.ts:100` | brand locale |
| 6 | `Europe/Warsaw` | `record.ts:101` | brand timezone |
| 7 | `nextjs-portal`, `lista-przyklejona` | `record.ts:114` | hidden selectors |
| 8 | `main` (screen guard) | `record.ts:312` | screen guard selector |
| 9 | Geist/Newsreader file names | `compose.ts:267-270` | brand fonts |
| 10 | FIRE logo SVG | `compose.ts:321` | brand logo |
| 11 | `#059669`, `rgba(236,241,247,.97)` | `compose.ts:37, 285` | caption colours |
| 12 | FIRE token names `accessible`, `locked`, `debt` | `site-tokens.ts:16-27`, `compose.ts` | brand colour roles |
| 13 | `P9yx385KN0FOmLll8Lkx` | `voiceover.ts:16` | voice id |
| 14 | `"pl"` voiceover language | `voiceover.ts:22` | voice language |
| 15 | `?z=` | `posts.ts:25` | channel link template |
| 16 | three platforms, link-in-bio table | `film.ts:10`, `posts.ts:12` | social platforms |
| 17 | five sound file names | `compose.ts:226-232` | sound effects |
| 18 | `?z=` and platform names in CLI output | `cli/main.ts:105` | derived from config |

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Contract | `src/config/*` (new schema, brand, design.json, load), `schema/marketing.schema.json` | owned by this item |
| Film model | `src/film.ts`, `src/cli/films.ts` | film data moves into `videos[]`; the scene module stays |
| Recording | `src/record/record.ts` | browser settings, hidden selectors, guard selector, viewport |
| Composition | `src/compose/{compose,timeline,site-tokens}.ts`, `src/render/render.ts` | fonts, logo, colours, geometry, sounds |
| Voice | `src/voice/voiceover.ts`, `src/cli/voice.ts` | voice id and language from config (key unchanged for `pl`) |
| Posts | `src/posts/posts.ts`, `src/messages/*` | link template, platform set, labels |
| CLI | `src/cli/{main,options,server}.ts` | `marketing.json`, video ids from config |
| Fixture and docs | `examples/fixture/*`, `tests/*`, `README.md` | the example config must validate and render |

## Data

None: no database. The only persisted data is the voiceover cache (`<key>.mp3` + `<key>.json`); its key
must not change for FIRE's existing entries (language `pl`, `voiceover.ts:55-60`).

## Tests

- Unit: `src/**/*.test.ts` (film, timeline, compose, site-tokens, posts, voiceover) and `tests/*.test.ts`
  (config, options, messages); `npx vitest run tools/marketing-kit` (about 1 s).
- End to end: `tests/render.test.ts`, opt-in `MARKETING_KIT_RENDER=1` (about 85 s, needs ffmpeg,
  Chromium 1194 and a headless shell, all present here: `/usr/bin/ffmpeg`, `/opt/pw-browsers/`).
- Repository: `tests/repo/packages.test.ts` checks every package's shape and `files`;
  `tests/repo` checks relative Markdown links.
- Gaps: no test pins the composed HTML as a whole (`compose.test.ts` asserts pieces), so geometry and
  style changes are guarded only by targeted assertions and the render test.

## Patterns to follow

- Results for expected failures: `{ ok: true, … } | { ok: false, error }` in this package
  (`config.ts:77`, `cli/options.ts:35`); `@softure-ai/core`'s `Result` is used by modules, not here.
- zod strict objects with doc comments per key (`config.ts:18-56`); options schemas in modules use
  `superRefine` with explicit `path` for cross-field checks (`modules/analytics/src/options.ts:59-65`).
- Copy only in `src/messages/{en,pl}.ts`, chosen by locale (`messages/index.ts:1-14`).

## Prior work

- `archive/2026-10-03-mk-core-port/` (MK-1): the port, the FIRE-shaped config, impl review F2 (move the
  throwing validators to results in MK-2) and FU-13 (render test outside CI).
- `archive/2026-10-02-ui-tokens-theme/research.md:158-161`: FIRE's `design.json` is schemaVersion 2 with
  `themes.{light,dark}.roles` and `themeColor`; the rest is documentation.
- `foundation/ui/tests/design-json.test.ts:5-35`: FIRE's role names (`background`, `surface`,
  `surface-raised`, `border`, `line-strong`, `foreground`, `muted`, `accent`, `accent-fill`,
  `accent-fill-hover`, `on-accent`, `accessible`, `locked`, `debt`).
- `docs/03-marketing-kit.md:41-80`: the draft contract this item finalises.

## SOFTURE modules

- **Channel analytics, partially relevant:** `@softure-ai/analytics` reads `?<param>=` with the default
  rule `^[a-z0-9]+(?:[-_][a-z0-9]+)*$`, at most 32 by default (`modules/analytics/src/options.ts:7-39`).
  The kit's codes must pass the reader of the app that receives them; importing analytics would pull db,
  Next and React into a CLI (MK-1 decision), so the rule is mirrored, not imported.
- **UI tokens, not applicable** as a dependency (React peer); its design.json shape is reused as reference.

## Risks

- **FIRE's paid voiceover cache orphaned** (medium likelihood if the key input changes): the key keeps
  `{text, voice, model, lang}` with `lang` from config; `pl` reproduces the pinned key.
- **Geometry refactor shifts the camera** (medium): the functions must give identical numbers for the
  390×844 @3 device; the existing timeline and compose tests pin values on paper.
- **Later items collide in `src/config/`** (high once MK-3…MK-7 run in parallel): the contract must
  already carry their sections, so each later item only consumes its part.
- **Injection through config strings into the composition** (low, the config is the project's own):
  colours are validated hex, font families and selectors are validated or escaped.

## Relevant lessons

- L-001 (build with tsc): the schema generator must not add a bundler; the JSON file is generated by a
  script or test, the build stays `tsc -p tsconfig.build.json`.

## Answers to unknowns

1. **Which `design.json` roles map to the brand colour roles.** Answered: design.json carries free role
   names per theme; FIRE's set (above) has `background`, `foreground`, `muted`, `accent` with the same
   meaning as the kit's roles, while the kit's CTA colour is FIRE's `accessible` and the caption
   colours have no role at all (`compose.ts:37, 285`). So a fixed table cannot cover FIRE; the mapping
   must default to same-name roles and let the project name the source role per brand role.
2. **Whether FIRE's TS film modules convert to JSON losslessly apart from scenes.** Answered: yes for
   every field but `scene` (`film.ts:59-80` are strings, numbers, string arrays and records); the
   per-beat `pad` lives in the scene call (`film.ts:85`), so it stays with the scene until MK-3.
   `channels` per film become per-platform codes (a film may override them).

## Open questions

- Where the TS scene lives after the move: **decided** (auto): `videos[].sceneModule`, a path to a
  module exporting `scene(director)`, the escape hatch `docs/03` already names; required until MK-3
  adds actions.
- The channel-code rule: **decided** (auto): the analytics default (`^[a-z0-9]+(?:[-_][a-z0-9]+)*$`,
  at most 32), because the SOFTURE app that receives the link counts it with that rule.
- Configurable platforms: **decided** (auto): a known set with labels in the dictionaries
  (instagram, facebook, tiktok, youtube, linkedin, x); the config picks which ones and their codes.
- Whether the voice language may become config before MK-7: **decided** (auto): yes, as an input to
  the unchanged key function; MK-7 still owns the provider interface and the cache migration.
