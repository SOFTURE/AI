# @softure-ai/marketing-kit

A CLI and a library that turn a project's **real app** into a vertical film (1080×1920, one file for
Instagram Reels, TikTok and Facebook Reels) plus ready post copy for each platform.

The film is not an animation that imitates the app. Playwright walks through the real page on a phone
screen frame by frame while a scene types and taps; the camera follows the thumb, captions follow the
voiceover word by word, and hyperframes renders the HTML composition to MP4.

Ported from FIRE_TRACKER's `video/` pipeline (roadmap item MK-1). Everything product-specific comes
from one `marketing.json` (MK-2), the scene included as declarative actions (MK-3); the 1:1 and 16:9 formats (MK-6),
TTS providers (MK-7), screenshots (MK-4) and OG images (MK-5) build on it. Background:
[docs/03-marketing-kit.md](../../docs/03-marketing-kit.md).

## Commands

```bash
softure-marketing all <video>                     # voiceover from the cache -> recording -> render -> post copy
softure-marketing voice <video> [--commit]        # voiceover; without --commit it only prints the cost estimate
softure-marketing record <video> [--today=YYYY-MM-DD] [--url=...]
softure-marketing render <video> [--quality=draft|standard|high]
softure-marketing preview <video>                 # the composition in the hyperframes preview
softure-marketing posts <video>                   # post copy only
```

Every command takes `--config=<path>` (default `./marketing.json`). Exit codes: `0` done, `1` failed, `2`
the screen guard refused the recording (the screen did not show what the voiceover says).

- **`--commit`** is the only way to spend money: `voice` prints the cost estimate, then calls the
  configured TTS provider (ElevenLabs, `ELEVENLABS_API_KEY` from the environment) and writes
  `<key>.mp3` + `<key>.json` into `voice.cacheDir`. Commit them: the next render of the same text costs
  nothing. `all` never pays; on a cache miss it prints the estimate and stops. See
  [Voiceover providers and cost](#voiceover-providers-and-cost).
- **`--today`** records the app as of another day, only to reproduce an old film.
- **Server:** when the configured app does not answer, `record` starts `app.startCommand` in the config
  folder on `app.port` and stops it afterwards (log in `<output.buildDir>/server.log`).
- Every command checks that the video's scene module exists (when it has one); `render`, `preview` and `all` also check
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
      { "id": "age", "text": "She types her age and taps next.", "actions": [
          { "do": "fill", "input": "age", "value": "36" },
          { "do": "until", "word": "taps" },
          { "do": "tap", "target": { "role": "button", "name": { "regex": "^Next$" } }, "after": 0.3 },
          { "do": "mark", "name": "exit-age", "target": { "testId": "exit-age" } },
          { "do": "focus", "target": [{ "text": "Exit age", "exact": true }, { "testId": "exit-age" }], "scale": 1.4 },
          { "do": "checkScreen" },
          { "do": "still", "name": "result" } ] },
      { "id": "cta", "text": "Count your own date.", "pad": 1.2, "actions": [{ "do": "wide" }] }
    ],
    "hook": { "still": "result", "shots": [{ "mark": "exit-age", "scale": 1.6 }] },
    "screenGuard": ["49 years"],
    "endCard": { "headline": "Count your date", "url": "example.com/calculator", "note": "Free, no account" }
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
| `videos[]` | `id`, `title`, `path`, `format` (`9:16`), `device`, `voice` (`voiceId`, `model`, `tempo`) | a film and its overrides |
| | `persona`, `beats`, `hook`, `screenGuard`, `endCard` | the script, see [A film](#a-film) |
| | `beats[].actions`, `beats[].pad` | the scene as data, see [Scene actions](#scene-actions) |
| | `sceneModule` | instead of actions: the TS module exporting `scene` |
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
| film modules with data and scene | the data in `videos[]`, the scene in `beats[].actions` (or `sceneModule`, `export const scene: Scene`) |
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

A film is a `videos[]` entry: the script and the scene, either as beat `actions` or as a scene module.
The fixture has the same film both ways in [examples/fixture/marketing.json](examples/fixture/marketing.json):
`fixture-tour-actions` with actions, `fixture-tour` with the module
[examples/fixture/films/fixture-tour.ts](examples/fixture/films/fixture-tour.ts). Both record the same log.

- **`beats`**: the voiceover sentences. The first plays over the opening (a frame of the result with a
  rewind), the last ends on the end card. Changing the text means a new, paid recording.
- **`actions`** on every beat after the first: what happens on screen during that sentence (below).
- **`sceneModule`**, the escape hatch for a scene that needs logic: a TS module exporting `scene`
  (typed `Scene`) that drives the Director itself: `d.beat(id, …, { pad })`, then the same methods as
  the actions (`d.fill(name, value)`, `d.tap(locator)`, `d.until(word)`, …). A video uses one or the other.
- **`screenGuard`**: every number the voiceover says, as the screen writes it. If the screen does not
  show one, the recording stops with code 2 and no film is made.

### Scene actions

Each action is `{ "do": "<name>", …arguments }` and calls the Director method of the same name.
Optional arguments left out keep the Director's defaults.

| `do` | Arguments (default) | What it does |
| --- | --- | --- |
| `wide` | `scale` (`1`), `whoosh` (`false`) | camera on the whole phone screen |
| `tap` | `target`, `after` (`0.35` s) | scrolls the element into view if needed and taps its centre |
| `type` | `text`, `perChar` (`0.13` s) | types into the focused element, one key at a time |
| `fill` | `input`, `value` | taps `input[name=<input>]`, moves the camera onto it and types the value |
| `blur` | | takes the focus off the active element |
| `focus` | `target` (one or many), `scale` (fits the element), `height` | camera on the element, or on the rectangle around several |
| `bring` | `target`, `top` (`140` px), `seconds` (`0.5`) | scrolls so the element's top edge stands `top` px from the top |
| `mark` | `name`, `target` (one or many) | remembers the rectangle, e.g. for an opening shot |
| `still` | `name` | remembers the current frame as the opening frame |
| `cue` | `name` (`sparkle`, `persona-out`) | an event on the film's timeline |
| `hold` | `seconds` (0-30) | lets the screen run |
| `until` | `word` | waits until the voiceover says this word of the sentence |
| `checkScreen` | | the screen guard, now |

A beat's `pad` (`0.35` s) is how long the screen holds after the voiceover ends the sentence.

A **target** is a locator descriptor with exactly one of these keys, plus `nth` (0 = the first match):

| Descriptor | Playwright | Options |
| --- | --- | --- |
| `{ "role": "button", "name": "Next" }` | `getByRole` | `name` (the accessible name), `exact` |
| `{ "text": "Your wealth today" }` | `getByText` | `exact` |
| `{ "label": "Age" }` | `getByLabel` | `exact` |
| `{ "testId": "exit-age" }` | `getByTestId` | |
| `{ "css": "label", "hasText": "I want to know" }` | `locator` | `hasText` |

`name`, `text`, `label` and `hasText` take a string (a case-insensitive substring; with `exact: true` the
whole text, case-sensitive) or a regex: `{ "regex": "^Next$", "flags": "i" }` (flags from `imsu`).
Without `nth`, a target that matches several elements fails while recording: add `nth`, or narrow it.

What can be checked without a browser is checked when the config loads, by JSON path: an `until` word
the sentence does not say, a `hook.still` or `hook.shots[].mark` no action saves, a scene without
`checkScreen`, actions on the opening sentence, actions next to a `sceneModule`. An action that fails
while recording names its path and the config file:

```text
✗ videos[0].beats[1].actions[2] (tap): sentence "age": getByRole('button', { name: /^Next$/ }) did not appear within 5 s. …
```

## Voiceover providers and cost

The voiceover goes through a `TtsProvider` (`src/voice/provider.ts`): `estimate(input)` is free and
needs no key, `synthesize(input)` returns the audio and the time of every word, or an error value.
`input` is `{ text, voiceId, model, language }`, and those four make the cache key
(`sha256({text, voice, model, lang})`, 16 hex characters). The tempo is applied at build time, so
changing it costs nothing.

| Run | What happens |
| --- | --- |
| the cache has `<key>.mp3` and `<key>.json` | `voiceover: from the cache <key>, nothing spent.` |
| no cache, no `--commit` | `voiceover estimate (elevenlabs): 412 characters, at most 412 ElevenLabs credits.` and a dry-run line; no request is sent |
| no cache, `--commit` | the same estimate line **first**, then one paid request, then the files are written |

ElevenLabs bills per input character, at most one credit each; API plans may discount it, so the
estimate is an upper bound. Providers available to `voice.provider`: `elevenlabs`. For tests, the
package exports `createFakeTtsProvider()` (deterministic audio, evenly spaced words, records its calls)
and `produceVoiceover({ cacheDir, input, provider, isCommit, log })`, so a project can test its films
without the network. A second real provider must add its id to the cache key, so that its recordings
never collide with ElevenLabs's under the same voice and model names.

### Migrating FIRE_TRACKER's voiceover cache

FIRE's key hashed the same object with the language fixed to `pl`, and its words files have the same
format, so its paid recordings are reused as they are, with no re-keying and no new paid call:

1. Copy FIRE's voiceover folder (`<key>.mp3` + `<key>.json` pairs) into `voice.cacheDir`.
2. Set `voice.language` to `"pl"`, and `voice.voiceId` and `voice.model` (or a video's `voice`
   override) to the values FIRE used.
3. Run `softure-marketing voice <video>` **without** `--commit` for every video. Each must print
   `from the cache`; an estimate line means the text, voice or model differs from FIRE's, and nothing
   was spent.

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

- Actions have no conditions or loops; a scene that needs them stays a `sceneModule`.
- One format, 9:16; the device is config, the frame layout is fixed until MK-6.
- ElevenLabs is the only real voice provider; the estimate is an upper bound in credits, not money.
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
