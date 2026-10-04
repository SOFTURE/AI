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
softure-marketing og [image]                      # OG images (PNG) of every ogImages entry, or of one
softure-marketing shots [<id>] [--url=...]        # the screenshots entries (or one), each behind its gates
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

Output: `<output.dir>/<video>/<video>.mp4` and `posts.md`, OG images in `<output.dir>/og/<image>.png`;
recordings and compositions in `<output.buildDir>/<video>/`. None of it belongs in git.

### Screenshots

`shots` captures every `screenshots[]` entry, or the one named, into `<output.dir>/screenshots/<id>.png`.
Each entry gets a fresh browser at `width`×`height` CSS px with `app.colorScheme`, `brand.locale`,
`brand.timezone`, `app.hideSelectors` hidden and its own `motion` preference (`reduce` by default).
`scale` sets the device pixels per CSS pixel (1-4, default 1): at `2` an 800×600 entry is a 1600×1200 PNG,
sharp on a retina screen or a store listing. `colorSchemes` (e.g. `["light", "dark"]`) captures the entry
once per scheme, in its own browser, into `<id>-light.png` and `<id>-dark.png`; without it, one `<id>.png`
in `app.colorScheme`. `shots <id>` takes the entry's id and writes all of its files. Since an entry may
write any of those three names, an id that is another entry's `<id>-light` or `<id>-dark` is refused.
`full: true` first scrolls the page one screen at a time to the bottom, so lazy images and sections
load, then captures the whole page. A screenshot is kept only when it passes every gate:

| Gate | Refused when |
| --- | --- |
| `status` | the page answers with HTTP 400 or above, or not at all (`load`: it did not load within 30 s) |
| `phrase` | the page does not show `expect` within 5 s of loading (hidden elements do not count) |
| `size` | the file is smaller than `minBytes` (40 kB by default: a blank or broken page); the file is deleted |

Each file of an entry passes the gates on its own, so a page that shows its phrase only in the dark scheme
keeps `<id>-dark.png` and refuses `<id>-light.png`. `minBytes` applies to every file as written, whatever the
`scale`: a larger scale only makes the file bigger, so the default floor stays safe.

A failed file is not left behind, nor is an older file of its entry (any of `<id>.png`, `<id>-light.png`,
`<id>-dark.png`), and the others still run; any failure ends with
exit code `1`. `--url` points at another address of the app; without it, `shots` uses `app.baseUrl` or
starts `app.startCommand` as `record` does. A plain page can be smaller than 40 kB: set `minBytes` for it
(the fixture's calculator, a dark page with one form, is about 16 kB and sets 5000).

## `marketing.json`

The contract is one zod schema (`src/config/schema.ts`), published as
[`schema/marketing.schema.json`](schema/marketing.schema.json) (also `@softure-ai/marketing-kit/marketing.schema.json`).
Point `$schema` at it for editor completion: every key carries a description (what it does, and its default when
the schema cannot state one), so an editor or an agent sees the reference below while typing. A broken file is refused with every problem at once, each
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
| | `device` | the recording device: `kind` (`phone`, or `desktop` for a browser window in a 16:9 film), `viewport` `[width, height]` in CSS px (a desktop's at least 1024 wide, not taller than wide), `scale` (device pixels per CSS pixel), `mobile` (a phone's, default `true`; never on a desktop); a video can override it |
| `voice` | `provider` (`elevenlabs`), `voiceId`, `model` (`eleven_multilingual_v2`), `language`, `tempo` (`1`, 0.8-1.3), `cacheDir` (`marketing/voiceover`) | the voiceover; text, voice, model and language make the cache key, the tempo is applied at build time |
| `videos[]` | `id`, `title`, `path`, `format` (`9:16`, or `1:1`, `16:9`), `device`, `voice` (`voiceId`, `model`, `tempo`) | a film and its overrides |
| | `persona`, `beats`, `hook`, `screenGuard`, `endCard` | the script, see [A film](#a-film) |
| | `beats[].actions`, `beats[].pad` | the scene as data, see [Scene actions](#scene-actions) |
| | `sceneModule` | instead of actions: the TS module exporting `scene` |
| `social` | `linkTemplate` | the link every post carries, `{code}` replaced by the platform's channel code |
| | `platforms` | `instagram`, `facebook`, `tiktok`, `youtube`, `linkedin`, `x`: `code`, `linkInBio` (true for Instagram, TikTok, YouTube) |
| | `posts[]` | `video`, `caption`, `hashtags`, `codes` (this video's own codes); a video without one gets no `posts.md` |
| `screenshots[]` | `id`, `path`, `width`, `height`, `full` (`false`), `expect`, `motion` (`reduce`), `minBytes` (`40000`), `scale` (`1`), `colorSchemes` | for `softure-marketing shots`, see [Screenshots](#screenshots) |
| `ogImages[]` | `id`, `template` (`headline-cta`, `headline-chart`), `size` (`[1200, 630]`), `data` | for `softure-marketing og`, see [OG images](#og-images) |
| `layout` | per layout (`9:16`, `1:1`, `16:9` for phone films; `desktop` for desktop films): `caption` (`top`, `left`, `right`, `fontSize`), `persona` (`top`, `left`, `right`), `endCard` (`top`, `left`, `right`, `headlineSize`, `phone.scale`, `phone.center`) | overrides of the layout's geometry table for every film of that layout, in frame px (`endCard.phone` is the browser window's pose in `desktop`); a missing key keeps the table's value. Values must fit the frame and each box's margins must leave at least 200 px for its text. The frame, the screen box and the camera target are fixed |
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

Actions cover what FIRE's film uses, not all of Playwright: no chained or filtered locators, no
`getByPlaceholder`, `getByAltText` or `getByTitle`, no role options beyond `name` and `exact`, no regex
`testId`; numbers stay in ranges that catch unit slips (`scale` 0.5-4, `after`, `perChar` and `seconds`
up to 10 s, `hold` up to 30 s, whole pixels for `top` and `height`). A scene that needs more is a
`sceneModule`.

What can be checked without a browser is checked when the config loads, by JSON path: an `until` word
the sentence does not say, a `hook.still` or `hook.shots[].mark` no action saves, an opening shot after
the first without the `word` it starts on, a scene without `checkScreen`, actions on the opening sentence,
actions next to a `sceneModule`. The checks that span
sentences run once the rest of the config is valid, so fixing one round of errors can reveal the next.
An action that fails while recording names its path and the config file:

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

## OG images

`softure-marketing og` renders each `ogImages` entry with [Satori](https://github.com/vercel/satori)
and resvg to `<output.dir>/og/<id>.png`, at `size` (1200×630 by default), outside Next. The brand
supplies everything around the copy: the background and text colours, the logo and name in the top
corner, and the fonts. `data` is the template's input, checked by its own schema (each template's
fields are in the JSON Schema):

| Template | `data` |
| --- | --- |
| `headline-cta` | `headline` (≤ 90 characters), `eyebrow` (≤ 40), `cta` (≤ 32, a pill in `cta`/`onCta` colours), `tiles` (≤ 4 of `label` ≤ 24, `value` ≤ 16) |
| `headline-chart` | `headline`, `eyebrow`, `tiles` (≤ 3), `chart`: `viewBox` `[width, height]` and `paths` (1-8) of `d` (SVG path data), `tone` (`accent`, `cta`, `foreground`, `muted`), `fill` (a tint instead of a line), `strokeWidth` (view box units) |

Values the app computes, such as a chart or a projected date, are computed by the app and arrive in
`data` as numbers, text or SVG paths; the package only draws them.

**Fonts.** Satori reads static `.ttf`, `.otf` and `.woff` files only, so OG images refuse a `.woff2`
file or a variable range (`"100 900"`) in `brand.fonts`, by its JSON path; add a static file for OG
next to it. Templates ask for a weight (the headline for 700, the copy for 400 and 600) and get the
nearest one the brand loads, so a card never names a weight that is not loaded (Satori would draw
another one silently). Satori draws nothing, or an empty box, for a character no font maps, so a
card is checked before layout: a character of the copy (or of `brand.name`) that none of the fonts
Satori would try has is refused with the image id, the JSON path and the characters, e.g.
`ogImages[0].data.headline: "…" (U+0105)` for a Polish letter with a `latin` subset file. Satori
tries one file per family, weight and style (the first one listed), then the other family, so a
second subset file of the same weight (`latin-ext` next to `latin`) is not used: ship one file per
weight that covers the copy's language. Whitespace, format characters and variation selectors are
not checked; emoji are, and need a font that has them.

**A thin Next route.** The `@softure-ai/marketing-kit/og` entry does not load Playwright, so a route
can render the same card per request, with live values in place of the configured `data`:

```ts
// app/calculator/opengraph-image.ts
import { join } from "node:path";
import { loadMarketingConfig, renderConfiguredOgImage } from "@softure-ai/marketing-kit/og";

export const runtime = "nodejs"; // resvg is a native module
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image(): Promise<Response> {
  const loaded = loadMarketingConfig(join(process.cwd(), "marketing.json"));
  if (!loaded.ok) throw new Error(loaded.error);
  const png = await renderConfiguredOgImage({
    config: loaded.config,
    id: "calculator",
    data: { headline: "Stop working at 49", cta: "Count your date" }, // optional: per-request values
  });
  if (!png.ok) throw new Error(png.error);
  return new Response(new Uint8Array(png.value), { headers: { "content-type": contentType } });
}
```

`@resvg/resvg-js` is a native module: if the bundler tries to bundle it, list it in
`serverExternalPackages` in `next.config.ts`. `renderOgImage({ template, data, size, brand, fonts })`
renders without a `marketing.json` at all.

## Requirements

- Node 22, **ffmpeg** in PATH.
- A Chromium for the recording and the screenshots: Playwright's own, or `PLAYWRIGHT_CHROMIUM_PATH=<path>`.
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
| satori, @resvg/resvg-js | MPL-2.0 | npm dependencies, unmodified; resvg ships a prebuilt native binary per platform |

## Limitations

- Actions have no conditions or loops; a scene that needs them stays a `sceneModule`.
- Three formats: `9:16` (1080×1920), `1:1` (1080×1080) and `16:9` (1920×1080). A phone film is a framed phone laid
  out by the geometry table in `src/compose/timeline.ts` (in 16:9 the phone stands left, the copy right);
  one phone recording renders in every format; `layout` in `marketing.json` moves the copy and the end card, not the
  phone. A desktop film (`device.kind: "desktop"`) is 16:9 only: the recorder opens a desktop browser (no touch,
  mouse clicks) and the film frames it as a browser window whose address bar shows the end card's URL. The same
  scene can record both when the app is responsive. Camera scales are relative to the screen, so an element as wide
  as a desktop page needs a lower scale (about 1.2) than on a phone, or the zoom crops it.
- ElevenLabs is the only real voice provider; the estimate is an upper bound in credits, not money.
- Two OG templates; a second subset file of the same weight is not used for OG images (FU-23).

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
MP4 with ffprobe. `MARKETING_KIT_KEEP=1` keeps the folder. CI runs it on every push in the `render` job of
[ci.yml](../../.github/workflows/ci.yml), with hyperframes on its own chrome-headless-shell.

The screenshot tests (`tests/screenshot.test.ts`, `tests/shots-cli.test.ts`) drive a browser against
static pages and the fixture app. They run whenever a Chromium is available (`PLAYWRIGHT_CHROMIUM_PATH`
or Playwright's own) and fail if `PLAYWRIGHT_CHROMIUM_PATH` names a missing file; CI points it at the
runner's Chrome.
