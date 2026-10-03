# Plan: mk-screenshots

Input: change.md, research.md, frame.md. Complexity: small (2 phases, one new module and a CLI command).

## Goal

- `softure-marketing shots [<id>] [--url=<address>] [--config=<file>]` renders every `screenshots[]`
  entry of `marketing.json`, or the one named, into `<output.dir>/screenshots/<id>.png`.
- Each entry is captured at `width`×`height` CSS px with the app's colour scheme, the brand's locale and
  timezone, the configured hidden selectors and the entry's `motion` preference; `full: true` scrolls the
  page to the bottom first so lazy content loads, then captures the whole page.
- Gates, in order: the HTTP status is below 400; the page shows `expect`; the file has at least
  `minBytes` bytes, otherwise it is deleted. A failed gate leaves no file and names the entry, the gate
  and the input. Every selected entry is attempted; any failure ends with exit code 1.
- Tests prove each gate both ways, the full-page scroll and the motion preference against a static page,
  and run in CI.

**Out of scope:** OG images (MK-5); new schema fields (device scale, image formats, theme pairs; see
frame.md option C); the recorder's browser setup in `src/record/` (MK-3 owns it); any change in
FIRE_TRACKER; a release.

## Approach

**Starting point:** the `screenshots[]` contract with defaults (`src/config/schema.ts:239-251`); no
command reads it; `ensureServer(config, video, explicitUrl)` (`src/cli/server.ts:20`) reads only
`video.url` and `video.ownUrl`.

**Chosen:** a module `src/screenshot/` with pure gate checks (`gates.ts`) and the browser capture
(`screenshot.ts`), returning one result value per entry; the CLI selects entries, ensures the app runs
(the shared helper with a narrowed parameter), prints each result and sets the exit code.
Rejected: per-shot flags (frame option A, a second source of truth); importing the recorder's setup
from `src/record/` (owned by MK-3, being rewritten in parallel).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Command | `shots [<id>]`; flags `--url` (another address of the app), `--config`; others refused for `shots` | frame option B | frame |
| Options type | `CliOptions` becomes a union: film commands keep their fields, `shots` has `shotId?`, `url?`, `configPath` | a screenshot is not a film; no optional bag | AGENTS.md TypeScript |
| Output | `<output.dir>/screenshots/<id>.png`; an old file of the entry is deleted before capture | a stale file must never look like a fresh pass | research |
| Server | `ensureServer(config, { url, ownUrl }, explicitUrl)` with the first selected entry's URLs; every entry resolves its `path` against the returned address | answers the roadmap's unknown | research |
| Browser | one Chromium per run, a new context per entry: viewport `width`×`height`, Playwright's default scale (1), `colorScheme`, `locale`, `timezoneId`, `reducedMotion: motion` | per-entry viewport and motion | research |
| Hidden elements | one style tag per `app.hideSelectors` entry plus instant scrolling, as the recorder does | same look as the films | research |
| Status gate | `page.goto` response; no response or status ≥ 400 fails | FIRE gate 1 | roadmap |
| Full page | scroll by one viewport height until the bottom (at most 100 steps), wait for network idle, back to the top, `fullPage: true` | lazy images load on scroll | roadmap |
| Phrase gate | `containsPhrase(body innerText, expect)`, polled for up to 5 s after load (and after the scroll) | client-rendered text; same rule as the screen guard | research |
| Size gate | `statSync(file).size < minBytes` → delete the file, fail with both numbers | FIRE gate 3 | roadmap |
| Result | `{ ok: true, id, file, bytes } \| { ok: false, id, gate: "load" \| "status" \| "phrase" \| "size", message }` | expected failures as values | AGENTS.md |
| Browser in CI | `PLAYWRIGHT_CHROMIUM_PATH: /usr/bin/google-chrome` on the `test` job; the browser tests skip only when no Chromium is configured or installed, and fail when the configured path is missing | gates covered in CI without a download | research |

## Phase 1: Capture and gates

**Changes:**
- `src/screenshot/gates.ts`: `findStatusFailure(status)`, `findSizeFailure(bytes, minBytes)` (pure).
- `src/screenshot/screenshot.ts`: `takeScreenshots({ entries, baseUrl, outDir, browser, executablePath })`
  → `ScreenshotResult[]`; `getScreenshotFile(outDir, id)`.
- `src/index.ts`: export both.
- `tests/fixtures/screenshots/`: a static page set (a tall page with a lazy section, a page whose text
  depends on `prefers-reduced-motion`), served by a `node:http` server inside the test.
- `tests/screenshot.test.ts`: gates (pure) and browser cases: pass, 404 refused, missing phrase refused,
  small file deleted, full page taller than the viewport with the lazy text found, motion reduce vs
  no-preference, an old file removed when the gate fails.

**Done when:** 1.1 the screenshot tests pass with a local Chromium; 1.2 gates green.

## Phase 2: Command, fixture, docs, CI

**Changes:**
- `src/cli/options.ts`: `shots` in `COMMANDS`, the union type, parsing and usage.
- `src/cli/server.ts`: parameter `{ url: string; ownUrl: string }`.
- `src/cli/main.ts`: the `shots` branch before `loadFilm`: select entries (unknown id → fail with the
  known ids; none configured → fail with a hint), ensure the server, capture, print `✓ <file> (<kB>)` or
  `✗ <id>: <message>`, exit 1 on any failure.
- `examples/fixture/marketing.json`: one screenshot entry of the fixture page.
- `tests/options.test.ts`: `shots` parsing; `tests/shots-cli.test.ts`: the CLI on the prepared fixture
  (starts the fixture app via `startCommand`) writes the PNG.
- `README.md`: the command, its gates, output path; limitations line updated.
- `.github/workflows/ci.yml`: `PLAYWRIGHT_CHROMIUM_PATH` on the `test` job.

**Done when:** 2.1 options, CLI and screenshot tests pass; 2.2 gates green (typecheck, lint, test, build).

## Risks and rollback

- Chrome on the runner moves or disappears: the browser tests fail loudly (configured path missing), the
  fix is the env line. Rollback: revert the commit; nothing persistent is written outside `output.dir`.
- Parallel items edit `cli/main.ts` and `cli/options.ts`: merge master before the PR and again before
  the merge; the `shots` branch is self-contained.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Capture and gates

#### Automated
- [ ] 1.1 Screenshot tests pass with a local Chromium
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Command, fixture, docs, CI

#### Automated
- [ ] 2.1 Options, CLI and screenshot tests pass
- [ ] 2.2 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 2.3 The fixture screenshot opens and shows the calculator in the configured colour scheme
