# @softure-ai/marketing-kit

A CLI and a library that turn a project's **real app** into a vertical film (1080×1920, one file for
Instagram Reels, TikTok and Facebook Reels) plus ready post copy for each platform.

The film is not an animation that imitates the app. Playwright walks through the real page on a phone
screen frame by frame while a scene types and taps; the camera follows the thumb, captions follow the
voiceover word by word, and hyperframes renders the HTML composition to MP4.

Ported from FIRE_TRACKER's `video/` pipeline (roadmap item MK-1). Everything product-specific comes
from one `marketing.json` (MK-2); declarative scene actions (MK-3), the 1:1 and 16:9 formats (MK-6),
TTS providers (MK-7), screenshots (MK-4) and OG images (MK-5) build on it. Background:
[docs/03-marketing-kit.md](../../docs/03-marketing-kit.md).

## Commands

```bash
softure-marketing all <video>                     # voiceover from the cache -> recording -> render -> post copy
softure-marketing voice <video> [--commit]        # voiceover; without --commit it only counts the characters
softure-marketing record <video> [--today=YYYY-MM-DD] [--url=...]
softure-marketing render <video> [--quality=draft|standard|high]
softure-marketing preview <video>                 # the composition in the hyperframes preview
softure-marketing posts <video>                   # post copy only
```

Every command takes `--config=<path>` (default `./marketing.json`). Exit codes: `0` done, `1` failed, `2`
the screen guard refused the recording (the screen did not show what the voiceover says).

- **`--commit`** is the only way to spend money: `voice` calls ElevenLabs (`ELEVENLABS_API_KEY` from the
  environment) and writes `<key>.mp3` + `<key>.json` into `voice.cacheDir`. Commit them: the next render
  of the same text costs nothing. `all` never pays.
- **`--today`** records the app as of another day, only to reproduce an old film.
- **Server:** when the configured app does not answer, `record` starts `app.startCommand` in the config
  folder on `app.port` and stops it afterwards (log in `<output.buildDir>/server.log`).
- Every command checks that the video's scene module exists; `render`, `preview` and `all` also check
  the brand files (logo, fonts, sound effects). A missing one is reported by its JSON path.

Output: `<output.dir>/<video>/<video>.mp4` and `posts.md`; recordings and compositions in
`<output.buildDir>/<video>/`. Neither belongs in git.

## `marketing.json`

The contract is one zod schema (`src/config/schema.ts`), published as
[`schema/marketing.schema.json`](schema/marketing.schema.json) (also `@softure-ai/marketing-kit/marketing.schema.json`).
Point `$schema` at it for editor completion. A broken file is refused with every problem at once, each
on its JSON path (`videos[0].beats[2].id: "scene" appears twice`). Every path resolves against the
folder of `marketing.json`. A complete example: [examples/fixture/marketing.json](examples/fixture/marketing.json).

```jsonc
{
  "$schema": "https://unpkg.com/@softure-ai/marketing-kit/schema/marketing.schema.json",
  "brand": {
    "name": "Acme Plan",
    "locale": "en-US",
    "timezone": "Europe/London",
    "logo": { "svg": "brand/mark.svg" },
    "tokensFrom": { "css": "../src/app/globals.css", "theme": "dark", "roles": { "cta": "success" } },
    "colors": { "captionBackground": "#ecf1f7", "captionHighlight": "#047857" },
    "fonts": {
      "body": { "family": "Inter", "files": [{ "path": "fonts/inter.woff2", "weight": "100 900" }] },
      "heading": { "family": "Lora", "fallback": "serif", "files": [{ "path": "fonts/lora-600.ttf", "weight": 600 }] }
    }
  },
  "app": {
    "baseUrl": "http://localhost:3000",
    "port": 3100,
    "startCommand": ["npx", "next", "dev", "-p", "{port}"],
    "colorScheme": "dark",
    "hideSelectors": ["nextjs-portal"],
    "screenGuardSelector": "main",
    "device": { "viewport": [390, 844], "scale": 3 }
  },
  "voice": { "voiceId": "<ElevenLabs voice id>", "language": "en", "tempo": 1.1 },
  "videos": [{
    "id": "calculator-tour", "title": "Anna counts her date", "path": "/calculator",
    "persona": { "name": "Anna", "age": 36, "tagline": "works out when she can stop working" },
    "beats": [
      { "id": "hook", "text": "Forty-nine years. That is when Anna stops working." },
      { "id": "age", "text": "She types her age and taps next." },
      { "id": "cta", "text": "Count your own date." }
    ],
    "hook": { "still": "result", "shots": [{ "mark": "exit-age", "scale": 1.6 }] },
    "screenGuard": ["49 years"],
    "endCard": { "headline": "Count your date", "url": "example.com/calculator", "note": "Free, no account" },
    "sceneModule": "scenes/calculator-tour.ts"
  }],
  "social": {
    "linkTemplate": "https://example.com/calculator?ref={code}",
    "platforms": { "instagram": { "code": "ig-01" }, "facebook": { "code": "fb-01" } },
    "posts": [{ "video": "calculator-tour", "caption": "Anna is 36 and can stop at 49.", "hashtags": ["money"] }]
  },
  "sfx": { "tap": "sfx/click.mp3", "key": "sfx/key.mp3", "whoosh": "sfx/whoosh.mp3", "sparkle": "sfx/sparkle.mp3", "pop": "sfx/pop.mp3" },
  "output": { "dir": "marketing/out", "buildDir": "marketing/build", "quality": "standard" }
}
```

| Section | Keys (default) | Meaning |
| --- | --- | --- |
| `brand` | `name`, `locale`, `timezone` | the end card's name; BCP 47 locale of the recording browser, `<html lang>` and the copy (its language needs a dictionary in `src/messages/`: `en`, `pl`); IANA zone of the recording browser |
| | `logo.svg` | the end card's logo next to the name (none: the name alone) |
| | `colors`, `tokensFrom` | the nine colour roles, see below |
| | `fonts.body`, `fonts.heading` | `family`, `fallback` (`sans-serif`), `files`: `path`, `weight` (`400` or `"100 900"`), `style` (`normal`), `unicodeRange`; none: the system's sans-serif. The heading font is the end card's and the avatar's; without one, the body font |
| `app` | `baseUrl`, `port`, `startCommand` | the running app, or the one the CLI starts (`startCommand` as arguments, no shell, `{port}` replaced) |
| | `colorScheme` (`light`), `hideSelectors` (`[]`), `screenGuardSelector` (`body`) | what the recording browser prefers; elements hidden while recording; the element whose text the screen guard reads |
| | `device` | the recorded phone: `viewport` `[width, height]` in CSS px, `scale` (device pixels per CSS pixel), `mobile` (`true`); a video can override it |
| `voice` | `provider` (`elevenlabs`), `voiceId`, `model` (`eleven_multilingual_v2`), `language`, `tempo` (`1`, 0.8-1.3), `cacheDir` (`marketing/voiceover`) | the voiceover; text, voice, model and language make the cache key, the tempo is applied at build time |
| `videos[]` | `id`, `title`, `path`, `format` (`9:16`, or `1:1`, `16:9`), `device`, `voice` (`voiceId`, `model`, `tempo`) | a film and its overrides |
| | `persona`, `beats`, `hook`, `screenGuard`, `endCard` | the script, see [A film](#a-film) |
| | `sceneModule` | the TS module exporting `scene` |
| `social` | `linkTemplate` | the link every post carries, `{code}` replaced by the platform's channel code |
| | `platforms` | `instagram`, `facebook`, `tiktok`, `youtube`, `linkedin`, `x`: `code`, `linkInBio` (true for Instagram, TikTok, YouTube) |
| | `posts[]` | `video`, `caption`, `hashtags`, `codes` (this video's own codes); a video without one gets no `posts.md` |
| `screenshots[]` | `id`, `path`, `width`, `height`, `full` (`false`), `expect`, `motion` (`reduce`), `minBytes` (`40000`) | for `softure-marketing shots` (MK-4) |
| `ogImages[]` | `id`, `template`, `size` (`[1200, 630]`), `data` (`{}`) | for `softure-marketing og` (MK-5) |
| `sfx` | `tap`, `key`, `whoosh`, `sparkle`, `pop` | sound effects; a missing one is silent |
| `output` | `dir` (`marketing/out`), `buildDir` (`marketing/build`), `quality` (`standard`) | where films go; `--quality` wins |

Channel codes follow the rule of `@softure-ai/analytics`, which counts them on the receiving app:
lowercase words joined by single dashes or underscores, at most 32 characters.

### Brand colours

| Role | Paints |
| --- | --- |
| `background` | the frame behind the phone and the vignette (`#rrggbb`) |
| `foreground`, `muted` | the end card and the persona card's text |
| `accent` | the touch ring, the end of the avatar's gradient |
| `cta`, `onCta` | the end card's link pill and its text; the avatar |
| `captionBackground`, `captionText`, `captionHighlight` | the caption pill, its words, the word being spoken |

A colour in `brand.colors` wins. Otherwise the role reads a token from `brand.tokensFrom`: the app's
stylesheet (`css`, custom properties in `[data-theme="<theme>"]`, then `:root`, `var()` resolved; a
stylesheet with other themes but not this one is an error) or an
Impeccable `design.json` (`designJson`, schemaVersion 2, `themes.<theme>.roles`). A role reads the token
of its own kebab name (`onCta` reads `on-cta`) unless `tokensFrom.roles` names another one, e.g.
`"roles": { "cta": "accessible", "onCta": "background" }`. A role with no colour is an error, never a
default. Values must be hex literals (`#rgb`, `#rrggbb`, `#rrggbbaa`).

### From FIRE_TRACKER's constants

| What MK-1 still had in code | Where it is now |
| --- | --- |
| `marketing.config.json` (`locale`, `brand.name`, `app`, `siteCss`, `posts.site`, `paths`) | `marketing.json`: `brand`, `app`, `brand.tokensFrom.css`, `social.linkTemplate`, `voice.cacheDir`, `output`, `sfx`, `brand.fonts` |
| film modules with data and scene | the data in `videos[]`, the scene in `sceneModule` (`export const scene: Scene`) |
| phone 390×844 @3, mobile | `app.device` |
| `pl-PL`, `Europe/Warsaw`, dark scheme | `brand.locale`, `brand.timezone`, `app.colorScheme` |
| hidden `nextjs-portal` and the mailing-list pill | `app.hideSelectors` |
| the screen guard reading `main` | `app.screenGuardSelector` |
| Geist and Newsreader files | `brand.fonts` |
| the arc logo, `#059669` and the light caption pill | `brand.logo`, `brand.colors.captionHighlight`, `captionBackground` |
| `--accessible` for the link pill and the avatar | `brand.colors.cta` (or `tokensFrom.roles.cta: "accessible"`) |
| FIRE's narrator voice, Polish | `voice.voiceId`, `voice.language: "pl"` (the cache keys of FIRE's paid recordings stay the same) |
| `?z=` and three fixed platforms | `social.linkTemplate`, `social.platforms` |
| five fixed sound file names | `sfx` |

## A film

A film is a `videos[]` entry plus a scene module. The fixture film is a complete example: its entry in
[examples/fixture/marketing.json](examples/fixture/marketing.json) and its scene in
[examples/fixture/films/fixture-tour.ts](examples/fixture/films/fixture-tour.ts).

- **`beats`**: the voiceover sentences. The first plays over the opening (a frame of the result with a
  rewind), the last ends on the end card. Changing the text means a new, paid recording.
- **`scene`** (exported by `sceneModule`, typed `Scene`): what happens on screen, sentence by sentence,
  through the Director: `d.beat(id, …)`, `d.fill(name, value)`, `d.tap(locator)`, `d.until(word)`,
  `d.focus(…)`, `d.wide()`, `d.mark(…)`, `d.still(…)`, `d.cue("sparkle" | "persona-out")`, `d.checkScreen()`.
- **`screenGuard`**: every number the voiceover says, as the screen writes it. If the screen does not
  show one, the recording stops with code 2 and no film is made.

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
| Fonts | the project's | not bundled; `brand.fonts` names the files, copied next to the composition at render time |
| Sound effects | the project's | not bundled; `sfx` names the files |
| ElevenLabs | paid API | key from `ELEVENLABS_API_KEY`, only with `--commit` |

## Limitations

- Scenes are TypeScript (`sceneModule`); declarative actions in `beats` are MK-3.
- Three formats: `9:16` (1080×1920), `1:1` (1080×1080) and `16:9` (1920×1080). Each is a framed phone laid
  out by the geometry table in `src/compose/timeline.ts` (in 16:9 the phone stands left, the copy right);
  one recording renders in every format. A desktop recording (FU-15) and layout overrides in `marketing.json` (FU-16) are not built.
- ElevenLabs is the only voice provider; the provider interface and a cost estimate are MK-7.
- `screenshots` and `ogImages` are validated but no command renders them yet (MK-4, MK-5).

## Development

```bash
npm test                                   # unit tests (FIRE's, ported), the contract, the architecture test
npm run schema -w @softure-ai/marketing-kit # regenerate schema/marketing.schema.json after changing the schema
MARKETING_KIT_RENDER=1 \
PLAYWRIGHT_CHROMIUM_PATH=... HYPERFRAMES_BROWSER_PATH=... \
  npx vitest run tools/marketing-kit/tests/render.test.ts   # the fixture film end to end (~1.5 min)
```

The render test copies [examples/fixture/](examples/fixture/) into a temporary folder, generates a tone
as its voiceover and tones as its sound effects with ffmpeg, runs `softure-marketing all` and checks the
MP4 with ffprobe. `MARKETING_KIT_KEEP=1` keeps the folder.
