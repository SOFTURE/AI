# Research: marketing-kit-adoption-gaps

Input: [`change.md`](change.md) (issue #118). Read on `master` e2d1974 and FIRE_TRACKER 2fead8d (read only).

## 1. `shots` today

- `src/cli/main.ts` `shots()`: picks entries from `config.screenshots`, builds an `AppTarget` from the **first**
  entry's `path` against `app.baseUrl`, and `ensureServer` (`src/cli/server.ts`) needs `fetch(url).ok` there, or it
  starts `app.startCommand`. `--url` replaces the base only (`new URL(first.path, options.url)`).
- `src/screenshot/screenshot.ts`: one Chromium for the run, one context per shot
  (`viewport`, `deviceScaleFactor`, `colorScheme`, `locale`, `timezoneId`, `reducedMotion`); init script injects
  `hideSelectors` and `scroll-behavior:auto`. `takeOne`: `goto(networkidle)` → status gate → `captureLoadedPage`:
  fonts ready → `full` lazy scroll → phrase gate (5 s poll) → `page.screenshot` → size gate (deletes the file).
  Everything is keyed by a `ScreenshotEntry` and a shot name; the file path is `<outDir>/<name>.png`.
- `src/cli/options.ts`: flags parse as `--[a-z]+(=value)`, unknown flags are refused (a typo must never switch a gate
  off, FIRE's lesson); `shots` accepts `--url` and `--config` only. `--url` must be http(s).
- Tests: `tests/screenshot.test.ts` (static pages from `tests/fixtures/screenshots/` on a local `http` server),
  `tests/shots-cli.test.ts` (the CLI on a copy of `examples/fixture`), `tests/options.test.ts`. Browser tests run
  when a Chromium exists (`PLAYWRIGHT_CHROMIUM_PATH`); the cloud container has `/opt/pw-browsers/chromium`.

## 2. What FIRE's `scripts/screenshot.mts` does that the kit does not

| FIRE flag | Behaviour | Kit today |
| --- | --- | --- |
| `--url` (any http(s) page), `--out` | one file anywhere, no server start, no config entry | entries only, `<output.dir>/screenshots/` |
| `--width`/`--height` (1440×900) | viewport | entry fields |
| `--expect` (optional there) | phrase gate | required `expect` |
| `--full` | lazy scroll then full page | `full` |
| `--wait` (1200 ms default) | sleep after load (and after the scroll) | none |
| `--ruch` | reduced motion; default `reduce` with `--full`, else `no-preference` | `motion`, default `reduce` |
| `--przewin=<px>` | `scrollTo(0, px)` then a viewport frame; refused with `--full` | none |
| scale fixed at 2, locale `pl-PL` | | `scale`, `brand.locale` |

FIRE's product screens behind login are shot inside a Playwright integration test (it signs in there); a CLI cannot
sign in generically, but Playwright's `storageState` (a JSON of cookies and localStorage, written by
`context.storageState({ path })`, `npx playwright codegen --save-storage=<file>` or a login script) restores a
session in `browser.newContext({ storageState })`. Measured in Playwright's types: `storageState` accepts a path or
an object; a missing file throws `ENOENT` from `newContext`, which today would escape `takeShot` as a bug.

## 3. Voiceover and render

- `createFakeTtsProvider` (`src/voice/fake.ts`) returns `Buffer.from("fake audio: …")`: not an MP3, so ffmpeg's
  `atempo` step in `src/render/render.ts:95` fails. It is a test double for the pipeline, not a rehearsal voice.
- `examples/fixture/prepare.ts` already makes what a rehearsal needs: words at a fixed pace with a pause between
  sentences, and a quiet sine tone (ffmpeg `lavfi sine`) as long as the words. ffmpeg is already a requirement of
  `render` (`src/render/preflight.ts`).
- `requireVoiceover` (`src/cli/voice.ts`) reads the cache; `record` stores `voiceoverKey` in `log.json` and `render`
  refuses a recording whose key differs from the current script's. That check is the guard a placeholder needs: a
  recording made on placeholder timings must not render with the real voiceover.
- Risk: writing the placeholder into `voice.cacheDir` under the real key would make every later `voice --commit`
  a cache hit, so the paid recording would never happen and the placeholder would ship. The placeholder must live in
  the build folder under its own key.

## 4. README facts

- hyperframes 0.8.85 (`node_modules/hyperframes/dist/cli.js` ~67744): looks for chrome-headless-shell in
  `~/.cache/hyperframes/chrome` first, then `~/.cache/puppeteer` as a fallback; `browser ensure` downloads into the
  former (`CACHE_DIR2`). The README says `~/.cache/puppeteer`.
- "From FIRE_TRACKER's constants" maps MK-1's hard-coded values to config keys. Its values are FIRE's look before
  RD-4 (2026-09-30). FIRE's `marketing.json` today: `brand.logo.svg: marketing/brand/mark.svg`,
  `tokensFrom.roles.cta: "accent"`, `captionHighlight: #356912`, Ubuntu fonts.
- Consumption: FIRE's `AGENTS.md` (marketing section) runs a pinned version through `npx` and explains why not a
  devDependency (>100 MB into Docker and every `npm ci`). The kit's README has no install section.

## 5. Answers to the unknowns

- **Ad-hoc trigger.** A separate `--page=<url>` flag rather than overloading `--url` (which stays "another base
  address of the app"): `--page` with `--out` and `--expect` takes one shot and never starts the app.
- **Config in ad-hoc mode.** Still loaded (locale, timezone, hide selectors, scheme), as every command loads it;
  the app adopting the kit has one.
- **Where storage state is declared.** Per entry (`storageState`, relative to `marketing.json`), since some screens
  are public and some are not; `--auth=<path>` for an ad-hoc shot. Checked before the browser starts.
- **Placeholder trigger.** `--placeholder` on `all`, `record` and `render`; pace from `voice.placeholder`
  (`wordsPerSecond`, `sentencePauseSeconds`). The film goes to `<video>.placeholder.mp4`, so it never replaces a real film.
