# Research: mk-core-port

Input: change.md, roadmap MK-1, research.sources (`docs/03-marketing-kit.md`, FIRE_TRACKER `video/**`).
Depth: normal (no data, no money; external binaries are the risk). Snapshot: df90013 on
claude/project-thread-minoa1 (master after PR #33), 2026-10-03 18:05 Europe/Warsaw. FIRE_TRACKER at 58e6c84.

## Summary

- FIRE's pipeline is seven files in `video/src/` (1,739 lines) plus six test files (570 lines):
  `voiceover.ts` 175, `timeline.ts` 118, `film.ts` 172, `record.ts` 344, `compose.ts` 342,
  `posts.ts` 69, `site-tokens.ts` 118, `cli.ts` 420 (`wc -l`). Everything except `cli.ts`, `record.ts`
  and `film.ts` is pure and already unit-tested.
- Two links to the FIRE app: `film.ts:3` imports `readChannelTag` from `src/lib/channel-tag.ts`, and
  `site-tokens.test.ts` reads the real `src/app/globals.css`. Both are replaceable inside the package
  (a local channel-code check with FIRE's shape; a CSS fixture in the test).
- `cli.ts` is bound to the FIRE repository: `ROOT = resolve(import.meta.dirname, "../..")` (`cli.ts:34`),
  every path is under `ROOT/video` or `ROOT/src/app/globals.css` (`cli.ts:35,153,338`), the server is
  `npx next dev -p 3100` in `ROOT` (`cli.ts:225`). A config file next to the project replaces `ROOT`.
- GSAP and hyperframes work as npm dependencies (measured below): `gsap@3.15.0` ships
  `dist/gsap.min.js`, copied at render time into the build folder; `hyperframes@0.8.85` ships a `bin`
  and renders with a local Chromium through `HYPERFRAMES_BROWSER_PATH`.
- No SOFTURE module covers this; the channel-code check is the only overlap (analytics), decided below.

## Current state

- **Voice** (`cli.ts:158-206`): cache key `sha256({text, voice, model, lang:"pl"})` sliced to 16 hex
  (`voiceover.ts:48-53`); without `--commit` it prints the character count and spends nothing
  (`cli.ts:171-176`); with it, `POST /v1/text-to-speech/<voice>/with-timestamps`, the alignment is
  narrowed by hand (`voiceover.ts:79-104`) and written as `<key>.mp3` + `<key>.json` into `video/voiceover/`.
- **Record** (`record.ts:65-344`): Chromium 390×844 @3, `page.clock.install` + `pauseAt`, CSS
  animations paused and stepped every 1/30 s (`record.ts:117-128`), one JPEG per frame; the Director
  (`beat`, `until`, `hold`, `bring`, `tap`, `type`, `fill`, `blur`, `focus`, `wide`, `mark`, `still`,
  `cue`, `checkScreen`) writes `log.json`. The screen guard throws `ScreenGuardError` (exit code 2).
- **Render** (`cli.ts:275-339`): ffmpeg builds `screen.mp4`, the 24-frame rewind (`timeline.ts:110-118`),
  the hook still, the last frame and the tempo-shifted voiceover; copies `assets/fonts`, `assets/sfx`
  and `assets/gsap.min.js`; writes `index.html` from `composeFilm` with colours from `readSiteTokens`;
  runs `npx -y hyperframes@0.8.85 render --quality <q> -o <out>`; writes `posts.md`.
- **Film** (`film.ts:70-90`): a TS module per film exporting `film` (beats, hook, screen guard,
  channels, end card, post, `scene(d)`), loaded with `import()` under `tsx` (`package.json:18-22`).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Package shell | `tools/marketing-kit/{package.json,tsconfig*.json,README.md}` | workspace package rules (`tests/repo/packages.test.ts:69-110`) |
| Core | `tools/marketing-kit/src/{voice,record,compose,render,posts}/` | the existing folder layout (`docs/03-marketing-kit.md`, "Package architecture") |
| Copy | `tools/marketing-kit/src/messages/{en,pl}.ts` | post labels and the persona card are user-facing (AGENTS.md) |
| CLI | `tools/marketing-kit/src/cli/` + `bin` | `softure-marketing` |
| Fixture | `tools/marketing-kit/examples/fixture/` | the draft MP4 baseline |
| Lockfile | `package-lock.json` | new dependencies |

## Data

None: no database. Files only (voiceover cache, `build/`, `out/`).

## Tests

- FIRE: `voiceover.test.ts` 89, `timeline.test.ts` 97, `film.test.ts` 87, `compose.test.ts` 131,
  `posts.test.ts` 42, `site-tokens.test.ts` 124 lines; `films/ania-calculator.test.ts` checks FIRE's
  paid voiceover and stays in FIRE with its film.
- Not covered in FIRE: `cli.ts` (argument parsing, preflight), `record.ts` (needs a browser).
- Here: Vitest picks up `tools/*/{src,tests}/**/*.test.ts` (`vitest.config.mts:33-36`). CI's test job
  has no browser and no hyperframes Chrome (`.github/workflows/ci.yml:36-62`), so a render test must be
  opt-in.

## Patterns to follow

- Package shape: copy of `templates/package/` (`package.json` exports with `@softure-ai/source`,
  `tsconfig.build.json`, `files: ["dist","src",…]`), build with `tsc` (L-001).
- Browser path: `PLAYWRIGHT_CHROMIUM_PATH` overrides Playwright's Chromium
  (`examples/next-app/playwright.config.ts:9`).
- External data as `unknown` narrowed by zod (AGENTS.md); zod `^4.6.5` is already a workspace
  dependency (`modules/analytics/package.json`).
- Language gate: diacritics and a Polish word list everywhere but `messages/` (`scripts/check-language.mjs:14-30`).

## SOFTURE modules

- Channel tags: **partially covered**. `@softure-ai/analytics/server` has `parseChannel(value, options)`
  (`modules/analytics/src/server/channel.ts:19`) but the package depends on `@softure-ai/db`, Next and
  React peers; a CLI should not install them. Decided: a local `isChannelCode` with FIRE's shape
  (`^[a-z0-9-]+$`, at most 20). MK-2 aligns it with analytics' default
  (`/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/`, `modules/analytics/src/options.ts:7`) when channels become config.
- Everything else: not applicable.

## Measurements

- `npm i hyperframes@0.8.85 gsap@3.15.0` in a scratch folder: 144 MB of `node_modules`, `bin`
  `hyperframes` and `hyperframes-localize-fonts`, no install script; `hyperframes --version` → 0.8.85.
- A one-second GSAP composition rendered with
  `HYPERFRAMES_BROWSER_PATH=/opt/pw-browsers/chromium_headless_shell-1194/... hyperframes render --quality draft`:
  6.5 s, 16 KB MP4, "beginframe capture · software gpu". No Chrome download was needed.
- hyperframes 0.8.85 accepts `--quality draft|looks|delivery|standard|high`; FIRE's three values are valid.

## Risks

- **Install weight**: +144 MB and `sharp` (native) for every `npm ci` of the monorepo. Accepted: the
  owner decided hyperframes is a dependency (roadmap constraint); `next` already brings `sharp`.
- **Polish copy in code**: `compose.ts:303,306` (`lang="pl"`, "lat", the brand name), `posts.ts:16-63`,
  all CLI and error messages. Copy goes to `messages/`, the brand name to config, messages to English.
- **Fonts and SFX are not bundled**: `compose.ts:207-210` names four FIRE font files, `compose.ts:186-192`
  five SFX files. The project supplies both folders through the config; the fixture generates its SFX.
- **TS films at runtime**: the built CLI is plain JS; a film is the project's TypeScript. `tsx`
  (`tsImport` from `tsx/esm/api`) loads it the way FIRE's `npm run video` does.
- **Telemetry**: hyperframes sends anonymous render telemetry unless `HYPERFRAMES_NO_TELEMETRY` is set
  (`grep` of `node_modules/hyperframes/dist`). A public package should not opt users in.

## Open questions

| Question | State | Answer |
| --- | --- | --- |
| Which tests depend on the FIRE app and how to stub them | answered | channel tags (`film.ts:3`) → local `isChannelCode`; `globals.css` (`site-tokens.test.ts:96-104`) → a fixture stylesheet in `tests/`; `ania-calculator.test.ts` stays in FIRE |
| Can GSAP and hyperframes be npm dependencies with nothing copied into the package | answered | yes: `gsap` and `hyperframes` (exact `0.8.85`) as dependencies; `gsap.min.js` is copied into the project's build folder at render time, never into the package (measured above) |
| Where the config lives and what it holds | decided (auto) | `marketing.config.json` (zod-validated, FIRE-shaped): films, voiceover, build, out, fonts, sfx, site CSS, app URL/port/start command, brand name, posts site, locale; `--config` overrides the path |
| hyperframes telemetry | decided (auto) | the CLI sets `HYPERFRAMES_NO_TELEMETRY=1` unless the user already set it |
| A render test in CI | decided (auto) | opt-in test (`MARKETING_KIT_RENDER=1`) run locally; a CI job is a followup gap |
