# @softure-ai/marketing-kit

A CLI and a library that turn a project's **real app** into a vertical film (1080×1920, one file for
Instagram Reels, TikTok and Facebook Reels) plus ready post copy for each platform.

The film is not an animation that imitates the app. Playwright walks through the real page on a phone
screen frame by frame while a scene types and taps; the camera follows the thumb, captions follow the
voiceover word by word, and hyperframes renders the HTML composition to MP4.

Ported from FIRE_TRACKER's `video/` pipeline (roadmap item MK-1). The configuration is still
FIRE-shaped until the `marketing.json` contract lands (MK-2). Full plan and the target contract:
[docs/03-marketing-kit.md](../../docs/03-marketing-kit.md).

## Commands

```bash
softure-marketing all <film>                     # voiceover from the cache -> recording -> render -> post copy
softure-marketing voice <film> [--commit]        # voiceover; without --commit it only counts the characters
softure-marketing record <film> [--today=YYYY-MM-DD] [--url=...]
softure-marketing render <film> [--quality=draft|standard|high]
softure-marketing preview <film>                 # the composition in the hyperframes preview
softure-marketing posts <film>                   # post copy only
```

Every command takes `--config=<path>` (default `./marketing.config.json`). Exit codes: `0` done, `1`
failed, `2` the screen guard refused the recording (the screen did not show what the voiceover says).

- **`--commit`** is the only way to spend money: `voice` calls ElevenLabs (`ELEVENLABS_API_KEY` from the
  environment) and writes `<key>.mp3` + `<key>.json` into the voiceover folder. Commit them: the next
  render of the same text costs nothing. `all` never pays.
- **`--today`** records the app as of another day, only to reproduce an old film.
- **Server:** when the configured app does not answer, `record` starts `app.startCommand` in the config
  folder on `app.port` and stops it afterwards (log in `<build>/server.log`).

Output: `<out>/<film>/<film>.mp4` and `<out>/<film>/posts.md`; recordings and compositions in
`<build>/<film>/`. Neither belongs in git.

## Configuration: `marketing.config.json`

Every path resolves against the folder of the config file.

```json
{
  "locale": "en",
  "brand": { "name": "Acme Plan" },
  "app": {
    "baseUrl": "http://localhost:3000",
    "path": "/calculator",
    "port": 3100,
    "startCommand": ["npx", "next", "dev", "-p", "{port}"]
  },
  "siteCss": "../src/app/globals.css",
  "posts": { "site": "https://example.com/calculator" },
  "paths": {
    "films": "films",
    "voiceover": "voiceover",
    "build": "build",
    "out": "out",
    "fonts": "assets/fonts",
    "sfx": "assets/sfx"
  }
}
```

| Key | Meaning |
| --- | --- |
| `locale` | `en` or `pl`: the persona card, `<html lang>` and the post copy (`src/messages/`) |
| `brand.name` | the brand name on the end card |
| `app` | the recorded page on a running app (`baseUrl` + `path`), or the app the CLI starts (`startCommand` as arguments, no shell, `{port}` replaced) |
| `siteCss` | the stylesheet the film's colours come from (`--background`, `--surface`, `--accent`, … in `:root` or `[data-theme="dark"]`) |
| `posts.site` | the page the posts link to; each platform's channel code is appended as `?z=` |
| `paths.films` | film modules, `<id>.ts` each |
| `paths.voiceover` | the paid voiceover cache (commit it) |
| `paths.fonts`, `paths.sfx` | the project's fonts and sound effects; nothing is bundled (see Licences) |

## A film

A film is a TypeScript module `<films>/<id>.ts` exporting `film` (typed with `Film` from this package).
The fixture film is a complete example: [examples/fixture/films/fixture-tour.ts](examples/fixture/films/fixture-tour.ts).

- **`beats`**: the voiceover sentences. The first plays over the opening (a frame of the result with a
  rewind), the last ends on the end card. Changing the text means a new, paid recording.
- **`scene(d)`**: what happens on screen, sentence by sentence, through the Director: `d.beat(id, …)`,
  `d.fill(name, value)`, `d.tap(locator)`, `d.until(word)`, `d.focus(…)`, `d.wide()`, `d.mark(…)`,
  `d.still(…)`, `d.cue("sparkle" | "persona-out")`, `d.checkScreen()`.
- **`screenGuard`**: every number the voiceover says, as the screen writes it. If the screen does not
  show one, the recording stops with code 2 and no film is made.
- **`channels`**: the `?z=` code per platform (lowercase letters, digits, hyphens, at most 20).

## Requirements

- Node 22, **ffmpeg** in PATH.
- A Chromium for the recording: Playwright's own, or `PLAYWRIGHT_CHROMIUM_PATH=<path>`.
- A Chrome for hyperframes: downloaded on the first render (into `~/.cache/puppeteer`), or
  `HYPERFRAMES_BROWSER_PATH=<path>` (a Chromium headless shell works).
- The CLI runs hyperframes with `HYPERFRAMES_NO_TELEMETRY=1` unless you set it yourself.

## Licences

| Asset | Licence | How the package handles it |
| --- | --- | --- |
| hyperframes `0.8.85` | Apache-2.0 | npm dependency, pinned, run from `node_modules` |
| GSAP | GreenSock's standard "no charge" licence | npm dependency `gsap`; `gsap.min.js` is copied into the project's build folder at render time, never shipped in this package |
| Fonts | the project's | not bundled; the composition loads `geist-latin-wght-normal.woff2`, `geist-latin-ext-wght-normal.woff2`, `newsreader-latin-wght-normal.woff2`, `newsreader-latin-ext-wght-normal.woff2` from `paths.fonts` and falls back to system fonts |
| Sound effects | the project's | not bundled; `click-soft`, `key-press`, `whoosh`, `sparkle`, `pop` (`.mp3`) from `paths.sfx` |
| ElevenLabs | paid API | key from `ELEVENLABS_API_KEY`, only with `--commit` |

## Limitations (until MK-2 and MK-7)

FIRE constants still in code: the 390×844 @3 phone and the 9:16 frame, `pl-PL` and `Europe/Warsaw` in
the recording browser, the hidden selectors (`nextjs-portal`, a FIRE test id), the screen guard reading
`main`, the end card's logo mark and caption colours, the font file names, the three platforms. The
voiceover language is fixed to Polish (it is part of the cache key, so FIRE's paid recordings keep
matching); it becomes config with the TTS adapters (MK-7).

## Development

```bash
npm test                                   # unit tests (FIRE's, ported) and config/CLI tests
MARKETING_KIT_RENDER=1 \
PLAYWRIGHT_CHROMIUM_PATH=... HYPERFRAMES_BROWSER_PATH=... \
  npx vitest run tools/marketing-kit/tests/render.test.ts   # the fixture film end to end (~1.5 min)
```

The render test copies [examples/fixture/](examples/fixture/) into a temporary folder, generates a tone
as its voiceover and tones as its sound effects with ffmpeg, runs `softure-marketing all` and checks the
MP4 with ffprobe. `MARKETING_KIT_KEEP=1` keeps the folder.
