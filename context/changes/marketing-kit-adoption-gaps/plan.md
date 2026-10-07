# Plan: marketing-kit-adoption-gaps

Input: change.md, research.md. Complexity: medium (four phases; 1-2 share the screenshot module, 3 is the voice
side, 4 the docs and the release bump).

## Goal

`@softure-ai/marketing-kit` 0.1.8: `shots` entries take `scrollTo`, `waitMs` and `storageState`; `shots
--page=<url> --out=<file> --expect=<phrase>` takes an ad-hoc shot behind the same gates; `all`, `record` and
`render` take `--placeholder` and render on a generated tone voiceover; the README fixes the Chrome cache path, the
FIRE constants table and says how an app consumes the kit. Every item of issue #118 is covered.

**Out of scope:** signing in from the CLI (a storage state is produced by the app's own login script or
`playwright codegen`); custom request headers; FIRE_TRACKER's switch to the kit (FIRE's change).

## Key decisions

| Decision | Choice | Source |
| --- | --- | --- |
| Scroll frame | entry `scrollTo` (px ≥ 0), viewport frame; refused with `full: true` | research §2 |
| Extra wait | entry `waitMs` (0-60000, default 0), after the scroll, before the phrase gate | research §2 |
| Signed-in screens | entry `storageState` (path relative to `marketing.json`), `--auth` ad hoc; missing or non-JSON file fails before the browser starts | research §2, §5 |
| Ad-hoc mode | `shots --page --out --expect` + `--width --height --scale --full --scroll --wait --motion --scheme --auth --minbytes`; no server start; config still loaded | research §5 |
| Ad-hoc defaults | 1440×900, scale 1, motion `reduce`, minBytes 40000, scheme `app.colorScheme` | schema defaults, FIRE's viewport |
| Placeholder | `--placeholder` on `all`/`record`/`render`; files in `<buildDir>/<video>/placeholder/`, key `placeholder-<key>`; film `<video>.placeholder.mp4`; never in `voice.cacheDir` | research §3 |
| Placeholder pace | `voice.placeholder.wordsPerSecond` (0.5-6, default 2.5), `sentencePauseSeconds` (0-3, default 0.5) | research §3 (fixture: 0.4 s a word, 0.5 s pause) |
| Version | 0.1.8 | run-wide order |

## Phase 1: Scroll frame, extra wait and storage state for entries

**Discipline:** TDD.
**Files:** `src/config/schema.ts`, `src/screenshot/screenshot.ts`, `src/cli/main.ts`, `tests/screenshot.test.ts`,
`tests/config.test.ts`, `tests/fixtures/screenshots/*`.

1. Schema: `scrollTo`, `waitMs`, `storageState` with `.describe()`; `scrollTo` with `full` refused by the entry's refine.
2. `captureLoadedPage`: `scrollTo` → `window.scrollTo`; a page that cannot reach the offset is refused by a new
   `scroll` gate (plan review 1); `waitMs` sleep; then the phrase gate and the capture.
3. `takeShot`: `storageState` passed to `newContext` as an absolute path; the CLI resolves it against the config
   folder (plan review 3).
4. CLI: a referenced storage state that is missing or not a JSON object fails before the browser starts, naming the
   entry and how to create one.
5. Tests: a page whose content appears only after a delay (wait), a page that reveals text at a scroll position
   (scroll frame shows it, the top frame does not), a page that shows its phrase only with a cookie (storage state);
   a scroll beyond the page refused by the `scroll` gate; schema: `scrollTo` + `full` refused, defaults.

## Phase 2: Ad-hoc shots

**Discipline:** TDD for options; test-after for the CLI run.
**Files:** `src/cli/options.ts`, `src/cli/main.ts`, `src/screenshot/screenshot.ts`, `tests/options.test.ts`,
`tests/shots-cli.test.ts`.

1. `ShotsOptions` becomes a union: `{ mode: "entries", shotId?, url? }` | `{ mode: "page", page, out, entry fields }`.
2. Parsing: `--page` requires `--out` (a `.png`) and `--expect`; refuses an entry id, `--url`, unknown or valueless
   flags; numbers validated like the schema (via `screenshotSchema` so the bounds are not repeated).
3. `takeScreenshot` (single target) exported next to `takeScreenshots`; `shots --page` runs it without
   `ensureServer`, deletes a stale `--out` first, prints `✓`/`✗` like entries.
4. Tests: option parsing (good, each refusal), the CLI against the fixture app's page (passes; wrong phrase exits 1
   and leaves no file).

## Phase 3: Placeholder voiceover

**Discipline:** TDD for the words; test-after for ffmpeg and the CLI.
**Files:** `src/voice/placeholder.ts` (new), `src/config/schema.ts`, `src/config/config.ts`, `src/cli/options.ts`,
`src/cli/voice.ts`, `src/cli/main.ts`, `src/index.ts`, tests.

1. `makePlaceholderWords(beats, pace)`: evenly spaced words, a pause between sentences (pure).
2. `writePlaceholderVoiceover({ dir, film, pace })`: words JSON + a quiet sine MP3 as long as the words + 0.5 s.
3. `--placeholder` on `all`, `record`, `render` (refused elsewhere); `record` stores `placeholder-<key>` in the log;
   `render` with a placeholder log and no flag (or the reverse) refuses and says which to run; output
   `<video>.placeholder.mp4`; `all --placeholder` skips the cache check.
4. Tests: words timing; options; the render test's mismatch path without ffmpeg; with ffmpeg, the MP3 is a real
   audio file of the expected length (ffprobe) — skipped when ffmpeg is missing.

## Phase 4: README, docs, schema and version

**Discipline:** test-after (repo tests check links).
**Files:** `tools/marketing-kit/README.md`, `schema/marketing.schema.json`, `package.json`, `package-lock.json`,
`docs/03-marketing-kit.md`.

1. README: ad-hoc shots, `scrollTo`/`waitMs`/`storageState` (with "keep it out of git"), `--placeholder`, the Chrome
   path (`~/.cache/hyperframes/chrome`, puppeteer as fallback), the FIRE constants table without a current-looking
   palette, an "Install" section recommending a pinned `npx` over a devDependency, "Upgrading to 0.1.8".
2. `npm run schema -w @softure-ai/marketing-kit`; bump to 0.1.8.

Done when (every phase): gates green (typecheck, lint, test); `npm run build`.

## Progress

- [ ] Phase 1: scroll frame, extra wait and storage state for entries
- [ ] Phase 2: ad-hoc shots
- [ ] Phase 3: placeholder voiceover
- [ ] Phase 4: README, docs, schema and version
