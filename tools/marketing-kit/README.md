# @softure-ai/marketing-kit

A CLI and a library that turn a project's **real app** into a vertical film (1080×1920, one file for
Instagram Reels, TikTok and Facebook Reels) plus ready post copy for each platform.

The film is not an animation that imitates the app. Playwright walks through the real page on a phone
screen (or a desktop browser, framed as a browser window in 16:9) frame by frame while a scene types and taps; the camera follows the thumb, captions follow the
voiceover word by word, and hyperframes renders the HTML composition to MP4.

Ported from FIRE_TRACKER's `video/` pipeline (roadmap item MK-1). Everything product-specific comes
from one `marketing.json` (MK-2), the scene included as declarative actions (MK-3); the 1:1 and 16:9 formats (MK-6),
TTS providers (MK-7), screenshots (MK-4) and OG images (MK-5) build on it. Background:
[docs/03-marketing-kit.md](../../docs/03-marketing-kit.md).

## Install

An app runs the kit through `npx` with a pinned version, not as a dependency:

```json
{ "scripts": { "marketing": "npx -y @softure-ai/marketing-kit@0.1.12" } }
```

`npm run marketing -- all <video>` then runs the CLI. As a `devDependency` the kit would add more than 100 MB
(hyperframes, Playwright, sharp, resvg) to every `npm ci` and to the deps stage of the app's Docker image, which
never runs it. Bump the pin and the `$schema` URL of `marketing.json` together. A project that imports the library
API (`@softure-ai/marketing-kit`, `@softure-ai/marketing-kit/og`) installs it as usual.

## Commands

```bash
softure-marketing all <video> [--placeholder]     # voiceover from the cache -> recording -> render -> post copy
softure-marketing voice <video>... [--commit]     # voiceovers in order; without --commit only the cost estimate
softure-marketing record <video> [--today=YYYY-MM-DD] [--url=...] [--placeholder]
softure-marketing render <video> [--quality=draft|standard|high] [--placeholder]
softure-marketing preview <video>                 # the composition in the hyperframes preview
softure-marketing posts <video>                   # post copy only
softure-marketing og [image]                      # OG images (PNG) of every ogImages entry, or of one
softure-marketing shots [<id>] [--url=...]        # the screenshots entries (or one), each behind its gates
softure-marketing shots --page=<url> --out=<file.png> --expect=<phrase> [...]   # one page anywhere, same gates
```

Every command takes `--config=<path>` (default `./marketing.json`). Exit codes: `0` done, `1` failed, `2`
the screen guard refused the recording (the screen did not show what the voiceover says).

- **`--commit`** is the only way to spend money: `voice` prints the cost estimate, then calls the
  configured TTS provider (ElevenLabs, `ELEVENLABS_API_KEY` from the environment) and writes
  `<video>/<key>.mp3` + `<video>/<key>.json` into `voice.cacheDir`. Commit them: the next render of the same text costs
  nothing. `all` never pays; on a cache miss it prints the estimate and stops. See
  [Voiceover providers and cost](#voiceover-providers-and-cost).
- **`voice` takes several videos** and records them in order: each paid call waits until `voice.minIntervalSeconds`
  have passed since the newest recording in the cache, and the first failure stops the batch (the summary names
  what was recorded, where it stopped and which videos were never sent). Without `--commit` the summary prints
  the batch's characters and estimate, so the cost is known before paying. Use it instead of a shell loop: a
  loop runs on after a failed call, and the provider sees every call it makes.
- **`--placeholder`** rehearses a film before paying for its voiceover: `all`, `record` and `render` use a free
  stand-in, a quiet tone with the script's words at `voice.placeholder.wordsPerSecond` (default 2.5) and
  `voice.placeholder.sentencePauseSeconds` (default 0.5) between sentences. It is written into
  `<output.buildDir>/<video>/placeholder/`, never into `voice.cacheDir` (where it would count as the paid recording),
  and the film goes to `<video>.placeholder.mp4`. A recording made on it renders only with `--placeholder`, and a
  recording made on the paid voiceover only without it. Match the pace to the voice to see the film's real length.
  `record <video> --placeholder` proves a new scene's actions and screen guard before paying, with no script around
  `createFakeTtsProvider`, no second cache directory and no copy of `marketing.json`.
- **`--today`** records the app as of another day for one run; it overrides the video's `today`. Once a
  voiceover is paid for, pin its day in the video's `today` instead, so a plain `all` reproduces the film in any
  later month (the voiceover says numbers that depend on the day).
- **Server:** when the configured app does not answer, `record` starts `app.startCommand` in the config
  folder on `app.port` and stops it afterwards (log in `<output.buildDir>/server.log`).
- Every command checks that the video's scene module exists (when it has one); `render`, `preview` and `all` also check
  the brand files (logo, fonts, sound effects). A missing one is reported by its JSON path.

Output: `<output.dir>/<video>/<video>.mp4` and `posts.md`, OG images in `<output.dir>/og/<image>.png`;
recordings and compositions in `<output.buildDir>/<video>/`. None of it belongs in git.

### Screenshots

`shots` captures every `screenshots[]` entry, or the one named, into `<output.dir>/screenshots/<id>.png`.
Each entry gets a fresh browser at `width`×`height` CSS px with `app.colorScheme`, `brand.locale`,
`brand.timezone`, `app.hideSelectors` and its own `hide` hidden, and its own `motion` preference (`reduce` by default).
`scale` sets the device pixels per CSS pixel (1-4, default 1): at `2` an 800×600 entry is a 1600×1200 PNG,
sharp on a retina screen or a store listing. `colorSchemes` (e.g. `["light", "dark"]`) captures the entry
once per scheme, in its own browser, into `<id>-light.png` and `<id>-dark.png`; without it, one `<id>.png`
in `app.colorScheme`. `shots <id>` takes the entry's id and writes all of its files. Since an entry may
write any of those three names, an id that is another entry's `<id>-light` or `<id>-dark` is refused.
`full: true` first scrolls the page one screen at a time to the bottom, so lazy images and sections
load, then captures the whole page. `scrollTo: <px>` instead captures one viewport frame scrolled that far, e.g. to
check scroll-driven motion (set `motion: "no-preference"` for it, or the page shows its end state). `waitMs` waits
that long after loading and scrolling, before the gates read the page, for an animation to settle (default 0).
`storageState` captures a signed-in screen: a Playwright storage state (cookies and localStorage), relative to the
folder of `marketing.json`, written by the app's own login script (`await context.storageState({ path })`) or by
`npx playwright codegen --save-storage=<file> <url>`. It holds a live session, so keep it out of git and regenerate
it when the session expires; a missing or broken file stops `shots` before the browser starts. To have `shots` sign
in itself, see [Signed-in screens](#signed-in-screens). `steps` run on the page after it loaded, before any gate
reads it: `click` (open a collapsed section), `fill`, `check`, `press`, `open`, `hide` and `flatten`, each with 10 s. `crop`
frames one element at a fixed aspect ratio instead of the viewport, see [A frame around one element](#a-frame-around-one-element);
`hide`, `crop.fill` and the `open`, `hide` and `flatten` steps give a frame its print state, see [A still image of an interactive card](#a-still-image-of-an-interactive-card).
A screenshot is kept only when it passes every gate:

| Gate | Refused when |
| --- | --- |
| `sign-in` | a `signedIn` entry, and the run's sign-in failed (the reason is printed with every such file) |
| `status` | the page answers with HTTP 400 or above, or not at all (`load`: it did not load within 30 s) |
| `steps` | a step could not be done (its element never appeared, matched several, is not an input, is not a `<details>`, left nothing to hide, matched nothing to flatten) |
| `scroll` | the page cannot scroll as far as `scrollTo` (the frame would show another place) |
| `phrase` | the page does not show `expect` within 5 s of loading (hidden elements do not count) |
| `crop` | the crop's target (or `crop.top`) matches no element or several, `crop.top` lies outside the target, `crop.fill` could not stretch the target to the frame, its frame runs past the page, or the file is not the frame's size |
| `hide` | a selector of the entry's `hide` still shows an element inside the frame (an inline `!important` beat it), or the browser cannot parse it |
| `size` | the file is smaller than `minBytes` (40 kB by default: a blank or broken page); the file is deleted |
| `duplicate` | an earlier file of the same run has the same bytes (the page did not change between the two shots); deleted |

Each file of an entry passes the gates on its own, so a page that shows its phrase only in the dark scheme
keeps `<id>-dark.png` and refuses `<id>-light.png`. `minBytes` applies to every file as written, whatever the
`scale`: a larger scale only makes the file bigger, so the default floor stays safe.

A failed file is not left behind, nor is an older file of its entry (any of `<id>.png`, `<id>-light.png`,
`<id>-dark.png`), and the others still run; any failure ends with
exit code `1`. `--url` points at another address of the app; without it, `shots` uses `app.baseUrl` or
starts `app.startCommand` as `record` does. A plain page can be smaller than 40 kB: set `minBytes` for it
(the fixture's calculator, a dark page with one form, is about 16 kB and sets 5000).

#### Signed-in screens

```jsonc
"signIn": {
  "prepare": ["npx", "tsx", "scripts/seed-marketing-account.ts"],
  "path": "/login",
  "steps": [
    { "do": "fill", "target": { "label": "Email" }, "value": "{data:email}" },
    { "do": "fill", "target": { "label": "Password" }, "value": "{env:MARKETING_PASSWORD}" },
    { "do": "click", "target": { "role": "button", "name": "Sign in" } }
  ],
  "expect": "Your accounts"
},
"screenshots": [
  { "id": "breakdown", "path": "/dashboard", "width": 390, "height": 900, "scale": 2, "signedIn": true,
    "expect": "{data:positionName}", "minBytes": 15000,
    "steps": [{ "do": "click", "target": { "text": "Components", "nth": 0 } }],
    "crop": { "target": { "css": "section", "hasText": "Portfolio" }, "aspect": "6:5" } }
]
```

An entry with `signedIn: true` is captured in the session of `signIn`. `shots` signs in once per run, before the
first such entry: it opens `signIn.path` in a fresh browser (the run's locale, timezone and scheme), does the
`steps`, and waits up to 15 s for `expect`. The phrase must be one only a signed-in page shows, and the browser must
then hold a cookie or a localStorage entry, or the sign-in fails. The session stays in memory and is never written
to disk; `sessionStorage` is not carried over, so an app that keeps its session there cannot be captured this way.
When the sign-in fails, every `signedIn` file is refused (gate `sign-in`) and the other entries still run.
`signedIn` and `storageState` exclude each other.

`signIn.prepare` (optional) is the app's own command that creates and seeds the account: arguments, no shell, run in
the folder of `marketing.json` once the app answers, with `MARKETING_BASE_URL` set to the app's address. It runs
only when a selected entry is `signedIn` or reads its data. Its last line of output must be a JSON object of
strings or numbers, e.g. `{"email": "demo-1@example.com", "positionName": "Bonds fund", "total": "12,345 USD"}`;
its output is not printed (it may hold a password), its errors are. Print values as the page shows them: the kit
formats nothing, so an amount the page writes as `12,345 USD` must be printed that way.

Placeholders, in `signIn.steps[].value`, `signIn.expect` and each entry's `path`, `expect` and `steps[].value`:

- `{env:NAME}`: an environment variable, e.g. the password of an account the app's seed script created. An unset
  or empty one stops `shots` before the app starts.
- `{data:key}`: a value `signIn.prepare` printed. With it in `expect`, the phrase gate proves the frame shows the
  seeded account, not an empty one or another account's. A key the output lacks stops `shots` before the browser
  starts; in `path` the value is URL-encoded.

No value is ever printed by the kit (a failing step names its index, not what it typed); a failing phrase gate
prints the phrase it looked for, so do not put a secret in `expect`.

#### A frame around one element

`crop: { target, aspect, padding }` captures one element instead of the viewport: `target` is a locator descriptor
as in [Scene actions](#scene-actions) (exactly one match; `nth` picks one of several), `aspect` is `W:H` (`"4:3"`,
`"6:5"`), `padding` the CSS pixels of page kept on the left, right and above (0-200, default 0). The frame is as wide
as the element plus the padding, starts at its top edge, and is as tall as the aspect asks: a card that is taller is
cut at the bottom, a shorter one shows what follows it. The viewport (`width`, `height`) still lays the page out,
so a 390 px wide entry frames the card as a phone shows it. The frame is taken from the whole page, not from the
viewport, so a sticky header does not cover the element and the element may lie below the first screen; a page
whose layout uses `100vh` may lay out taller for the capture. The file is the frame × `scale` (a 358 px wide card at
`6:5` and scale 2 is 716×596) and is checked against it. A frame running past the page's edge is refused; so is a
target that matches nothing or several elements. `crop` excludes `full` and `scrollTo`. An element is smaller than
a page, so set `minBytes` for it (15000 is a fair floor for a filled card).

`crop.top` (a second locator, exactly one match) starts the frame at its element's top edge instead of the target's,
e.g. a row inside a card, while the width stays the target's. Its top edge must lie inside the target, or the crop
is refused: the frame would no longer show the target.

`crop.fill: true` stretches a target that is shorter than its frame down to the frame's bottom edge and centres its
content vertically (`min-height` and a centred flex column, inline with `!important`, in the capture browser only), so
no page background or next card shows below it. A target that is already as tall as the frame is left as it is. The
`crop` gate refuses the file when the target still ends above the frame's bottom edge (an SVG, or a script that resets
its style). `crop.fill` excludes `crop.top`: centring would move the row the frame starts at.

#### A still image of an interactive card

A frame of a signed-in card shows controls that mean nothing in a still image: hint `?` buttons, disclosure arrows,
closed sections, a chart that scrolls sideways and cuts its first amounts at the edge. An entry gives the frame its
print state:

```jsonc
{ "id": "breakdown", "path": "/dashboard", "width": 390, "height": 900, "scale": 2, "signedIn": true,
  "expect": "{data:positionName}", "minBytes": 15000,
  "hide": ["button.hint", "summary .arrow", ".chart-footnote"],
  "steps": [
    { "do": "open", "target": { "css": "details" } },
    { "do": "hide", "target": { "css": ".chart .column" }, "keepLast": 3 }
  ],
  "crop": { "target": { "testId": "breakdown-card" }, "top": { "testId": "breakdown-total" }, "aspect": "6:5" } }
```

- `hide`: CSS selectors hidden in this entry's files only, on top of `app.hideSelectors`, from the first paint. Before
  the capture, the `hide` gate refuses the file when one of them still matches a rendered element inside the frame
  (the crop's frame, the whole page with `full`, the viewport otherwise): an inline `!important` on the page beats the
  kit's rule, and an element the frame keeps showing would look clickable. A selector that matches nothing passes.
- `{ "do": "open", "target": … }` opens every matching `<details>` (`nth` picks one). It fails when a match is not a
  `<details>`, or does not stay open: details that share a `name` show one at a time.
- `{ "do": "hide", "target": …, "keepLast": N }` hides every match but the last `N` (default 0: all of them), e.g. all
  but the last three columns of a chart that scrolls sideways, so no amount is cut at the frame's edge. It fails when
  there are not more matches than `keepLast`, which hides nothing.
- `{ "do": "flatten", "target": … }` removes the top border and top margin of every match, e.g. the line a list's
  `border-top` draws above the first row a print state still shows. It fails when nothing matches.

One row of a card, when the rest is hidden and the card is shorter than its frame: `crop.fill` stretches the card to
the frame and centres the row, and `flatten` drops the border the list kept above it.

```jsonc
{ "id": "frame-change", "path": "/dashboard", "width": 390, "height": 900, "scale": 2, "signedIn": true,
  "expect": "Change since last month", "minBytes": 15000,
  "steps": [
    { "do": "open", "target": { "css": "details.change" } },
    { "do": "hide", "target": { "css": "section.rail > header" } },
    { "do": "hide", "target": { "css": "section.rail > div" } },
    { "do": "hide", "target": { "css": "section.rail > dl > div" }, "keepLast": 1 },
    { "do": "flatten", "target": { "css": "section.rail > dl" } }
  ],
  "crop": { "target": { "css": "section.rail" }, "aspect": "6:5", "fill": true } }
```

#### One page anywhere: `shots --page`

```bash
softure-marketing shots --page=https://example.com/pricing --out=shots/pricing.png --expect="Pricing" \
  [--width=1440 --height=900 --scale=1 --full --scroll=<px> --wait=<ms> --motion=reduce|no-preference \
   --scheme=light|dark --auth=<storage-state.json> --minbytes=40000]
```

A competitor's page, production, or any page that is not a `screenshots` entry: the same browser settings
(`brand.locale`, `brand.timezone`, `app.hideSelectors`, `app.colorScheme` unless `--scheme`) and the same gates, one
file at `--out` (relative to the current directory; an older file there is removed first). The flags are the entry's
fields: `--scroll` is `scrollTo`, `--wait` is `waitMs`, `--auth` is `storageState` (relative to the current
directory), `--minbytes` is `minBytes`; the viewport defaults to 1440×900. `--expect` is required, so an error page
is never kept. The app is not started and `--url` does not apply. Every flag needs `=<value>` except `--full`, and
an unknown flag stops the run: a typo must never switch a gate off.

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
| | `device` | the recording device: `kind` (`phone`, or `desktop` for a browser window in a 16:9 film), `viewport` `[width, height]` in CSS px (a desktop's at least 1024 wide, not taller than wide), `scale` (device pixels per CSS pixel), `mobile` (a phone's, default `true`; not allowed on a desktop); a video can override it |
| `voice` | `provider` (`elevenlabs`), `voiceId`, `model` (`eleven_multilingual_v2`), `language`, `tempo` (`1`, 0.8-1.3), `cacheDir` (`marketing/voiceover`), `minIntervalSeconds` (`60`, 0-3600, `0` off) | the voiceover; text, voice, model and language make the cache key, the tempo is applied at build time; paid calls are spaced by `minIntervalSeconds`, counted from the newest recording in the cache, so separate runs are spaced too |
| `videos[]` | `id`, `title`, `path`, `format` (`9:16`, or `1:1`, `16:9`), `device`, `voice` (`voiceId`, `model`, `tempo`) | a film and its overrides |
| | `persona`, `beats`, `hook`, `screenGuard`, `endCard` | the script, see [A film](#a-film) |
| | `hook.transition` (`fade`, or `rewind`, `cut`) | how the opening frame hands over to the scene |
| | `today` (`YYYY-MM-DD`) | the day the app is recorded as of; none: the day of the run; `--today` wins |
| | `beats[].actions`, `beats[].pad` | the scene as data, see [Scene actions](#scene-actions) |
| | `sceneModule` | instead of actions: the TS module exporting `scene` |
| `social` | `linkTemplate` | the link every post carries, `{code}` replaced by the platform's channel code |
| | `platforms` | `instagram`, `facebook`, `tiktok`, `youtube`, `linkedin`, `x`: `code`, `linkInBio` (true for Instagram, TikTok, YouTube) |
| | `posts[]` | `video`, `caption`, `hashtags`, `codes` (this video's own codes), `disclosure` (`true`; `false` leaves the disclosure out); a video without one gets no `posts.md` |
| | `disclosure` | a paragraph after every post's caption, before the link: that the persona is an example, that it is not advice, that the voice is AI-generated; `{persona}` becomes the video's persona name |
| `screenshots[]` | `id`, `path`, `width`, `height`, `full` (`false`), `expect`, `motion` (`reduce`), `minBytes` (`40000`), `scale` (`1`), `colorSchemes`, `scrollTo`, `waitMs` (`0`), `storageState`, `signedIn` (`false`), `steps` (`[]`), `crop`, `hide` (`[]`) | for `softure-marketing shots`, see [Screenshots](#screenshots) |
| `signIn` | `prepare`, `path`, `steps`, `expect` | how `shots` signs in for `signedIn` entries, see [Signed-in screens](#signed-in-screens) |
| `ogImages[]` | `id`, `template` (`headline-cta`, `headline-chart`, `big-number`, `carousel`), `size` (`"landscape"`, `"portrait"`, `"square"`, `"story"` or `[width, height]`; `landscape` for the headline cards, `portrait` for the others), `data` | for `softure-marketing og`, see [OG images](#og-images) |
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

What MK-1 hard-coded and the key that holds it now. The table names the kind of value, not the value: a project's
look changes in its own `marketing.json`, without a change to the kit.

| What MK-1 still had in code | Where it is now |
| --- | --- |
| `marketing.config.json` (`locale`, `brand.name`, `app`, `siteCss`, `posts.site`, `paths`) | `marketing.json`: `brand`, `app`, `brand.tokensFrom.css`, `social.linkTemplate`, `voice.cacheDir`, `output`, `sfx`, `brand.fonts` |
| film modules with data and scene | the data in `videos[]`, the scene in `beats[].actions` (or `sceneModule`, `export const scene: Scene`) |
| phone 390×844 @3, mobile | `app.device` |
| `pl-PL`, `Europe/Warsaw`, dark scheme | `brand.locale`, `brand.timezone`, `app.colorScheme` |
| hidden `nextjs-portal` and the mailing-list pill | `app.hideSelectors` |
| the screen guard reading `main` | `app.screenGuardSelector` |
| Geist and Newsreader files | `brand.fonts` |
| the logo, the caption highlight colour and the light caption pill | `brand.logo`, `brand.colors.captionHighlight`, `captionBackground` |
| the token used for the link pill and the avatar | `brand.colors.cta` (or `tokensFrom.roles.cta: "<token>"`) |
| FIRE's narrator voice, Polish | `voice.voiceId`, `voice.language: "pl"` (the cache keys of FIRE's paid recordings stay the same) |
| `?z=` and three fixed platforms | `social.linkTemplate`, `social.platforms` |
| five fixed sound file names | `sfx` |

## A film

A film is a `videos[]` entry: the script and the scene, either as beat `actions` or as a scene module.
The fixture has the same film both ways in [examples/fixture/marketing.json](examples/fixture/marketing.json):
`fixture-tour-actions` with actions, `fixture-tour` with the module
[examples/fixture/films/fixture-tour.ts](examples/fixture/films/fixture-tour.ts). Both record the same log.

- **`beats`**: the voiceover sentences. The first plays over the opening (a frame of the result), the last
  ends on the end card. Changing the text means a new, paid recording.
- **`hook.transition`**: how the opening frame hands over to the scene's first frame. `fade` (the default) is a
  0.8 s cross-fade; `rewind` runs 0.8 s back through the scene in five key frames joined by dissolves; `cut`
  starts the scene at once. Before 0.1.6 every film had a rewind of 24 blended frames that flickered; a film
  rendered again now opens with a fade unless it asks for `rewind`.
- **`today`**: the day the app is recorded as of. Pin it to the day the voiceover's numbers were true, so the
  screen guard keeps passing after the calendar moves.
- **`actions`** on every beat after the first: what happens on screen during that sentence (below).
- **`sceneModule`**, the escape hatch for a scene that needs logic: a TS module exporting `scene`
  (typed `Scene`) that drives the Director itself: `d.beat(id, …, { pad })`, then the same methods as
  the actions (`d.fill(name, value)`, `d.tap(locator)`, `d.until(word)`, …). A video uses one or the other.
- **`screenGuard`**: every number the voiceover says, as the screen writes it. If the screen does not
  show one, the recording stops with code 2 and no film is made. The video's list is checked at every
  `checkScreen`, all phrases at once, so place it after the last action that reveals one of them.
- **`beats[].screenGuard`**: the phrases one sentence says, checked while that sentence is on screen: at a
  `checkScreen` inside the sentence (together with the video's list), or, without one, when the sentence ends,
  after its `pad`. A film whose later sentence reveals a number keeps proving the earlier numbers were on screen
  when the voiceover said them. Any sentence but the first can carry one, with `actions` or a `sceneModule`; when
  the sentences carry every phrase, the video's `screenGuard` and the `checkScreen` can be left out.

### Scene actions

Each action is `{ "do": "<name>", …arguments }` and calls the Director method of the same name.
Optional arguments left out keep the Director's defaults.

| `do` | Arguments (default) | What it does |
| --- | --- | --- |
| `wide` | `scale` (`1`), `whoosh` (`false`) | camera on the whole screen |
| `tap` | `target`, `after` (`0.35` s) | scrolls the element into view if needed and taps its centre (clicks it on a desktop) |
| `type` | `text`, `perChar` (`0.13` s) | types into the focused element, one key at a time |
| `press` | `key`, `times` (`1`, up to 50), `perKey` (`0.13` s) | presses a key on the focused element: a Playwright key name such as `Backspace`, `Enter`, `Tab` or `ControlOrMeta+A` (Meta on macOS, Control elsewhere) |
| `fill` | `input`, `value`, `clear` (`true`) | taps `input[name=<input>]`, moves the camera onto it (1.55×; on a desktop at most what still fits the frame) and types the value. A value already in the field (a prefilled default, or one the app sets on focus) is selected and deleted on screen first, so `fill intentAge 50` over `45` ends as `50`; if the app puts a value back, the action fails. `clear: false` types after the old value (`4550`) |
| `blur` | | takes the focus off the active element |
| `focus` | `target` (one or many), `scale` (fits the element), `height` | camera on the element, or on the rectangle around several |
| `bring` | `target`, `top` (`140` px), `seconds` (`0.5`) | scrolls so the element's top edge stands `top` px from the top |
| `mark` | `name`, `target` (one or many) | remembers the rectangle, e.g. for an opening shot |
| `still` | `name` | remembers the current frame as the opening frame |
| `cue` | `name` (`sparkle`, `persona-out`) | an event on the film's timeline |
| `hold` | `seconds` (0-30) | lets the screen run |
| `until` | `word` | waits until the voiceover says this word of the sentence |
| `checkScreen` | | the screen guard, now: the video's `screenGuard` and the current sentence's |

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
the first without the `word` it starts on, a scene without `checkScreen` while the video has its own `screenGuard`,
a film with no screen guard phrase at all, actions, a pad or a `screenGuard` on the opening sentence,
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
| the cache has `<video>/<key>.mp3` and `.json` (or, from 0.1.5 and earlier, `<key>.mp3` and `.json` in the cache root) | `voiceover: from the cache <key>, nothing spent.` |
| no cache, no `--commit` | `voiceover estimate (elevenlabs): 412 characters, at most 412 ElevenLabs credits.` and a dry-run line; no request is sent |
| no cache, `--commit` | the same estimate line **first**, a wait when the last paid recording is under `voice.minIntervalSeconds` old, then one paid request, the charge the provider reported (`voiceover: elevenlabs charged 175 ElevenLabs credits for 412 characters (the estimate was at most 412).`), then the files are written |

ElevenLabs bills per input character, at most one credit each; API plans may discount it, so the
estimate is an upper bound (FIRE_TRACKER paid about 0.42 credits per character). The real charge comes from the
`character-cost` response header; a provider that does not report one gets a line saying so. Providers available to `voice.provider`: `elevenlabs`. For tests, the
package exports `createFakeTtsProvider()` (deterministic audio, evenly spaced words, records its calls)
and `produceVoiceover({ cacheDir, input, provider, isCommit, pace, log })` (`produceVoiceovers` for a batch,
`waitForPace` for a project's own loop), so a project can test its films
without the network. A second real provider must add its id to the cache key, so that its recordings
never collide with ElevenLabs's under the same voice and model names.

### The cache layout

Each video keeps its recordings in its own folder, `<voice.cacheDir>/<video id>/<key>.mp3` and `<key>.json`, so a
reader sees which film a paid file belongs to. The key is unchanged from earlier versions, so nothing is recorded
again:

- A recording saved by 0.1.5 or earlier sits flat in `voice.cacheDir`. It is still found (the video's folder first,
  then the flat file), and `voice`/`all` print where to move it; `git mv` both files into the video's folder.
- When the script changes, the new recording lands next to the old one, and `voice`/`all` list the files in the
  folder the current script no longer uses. Delete them in git once no film needs them.

### Migrating FIRE_TRACKER's voiceover cache

FIRE's key hashed the same object with the language fixed to `pl`, and its words files have the same
format, so its paid recordings are reused as they are, with no re-keying and no new paid call:

1. Copy FIRE's voiceover folder (`<key>.mp3` + `<key>.json` pairs) into `voice.cacheDir`, ideally into the folder of
   the video each pair belongs to (`<voice.cacheDir>/<video id>/`); flat files are found too.
2. Set `voice.language` to `"pl"`, and `voice.voiceId` and `voice.model` (or a video's `voice`
   override) to the values FIRE used.
3. Run `softure-marketing voice <video>` **without** `--commit` for every video. Each must print
   `from the cache`; an estimate line means the text, voice or model differs from FIRE's, and nothing
   was spent.

### Upgrading to 0.1.12

- A 0.1.11 `marketing.json` works as it is. New: `crop.fill` and the step `flatten`. An app that frames one row of a
  card with its own capture styles (a `min-height` on the card, a dropped `border-top`) can move that frame to
  `marketing.json`.

### Upgrading to 0.1.11

- A 0.1.10 `marketing.json` works as it is. New: `hide` on entries (with the `hide` gate), `crop.top`, and the steps
  `open` and `hide`. An app that still captures its signed-in frames with its own browser test because it injects a
  print stylesheet, opens every `<details>` or trims a sideways chart can move that file to `marketing.json` too.
- `SCREENSHOT_GATES` lists the new gate `hide`; code that switches over `ScreenshotGate` exhaustively needs its case.

### Upgrading to 0.1.10

- A 0.1.9 `marketing.json` works as it is, with one new refusal: two files of one `shots` run with the same bytes
  (gate `duplicate`). A `colorSchemes` pair of a page that ignores the scheme now keeps the first file only; drop
  `colorSchemes` there, or give the page its other scheme.
- New: `signIn` (sign in once per run, optionally after a `prepare` command that seeds the account), `signedIn`,
  `steps` and `crop` on entries, and `{env:NAME}` / `{data:key}` placeholders. An app that generates its signed-in
  product frames with its own browser test (sign in, seed, check a seeded value is on screen, crop a card at a
  fixed ratio, compare the files) can move that to `marketing.json`.

### Upgrading to 0.1.9

- A 0.1.8 `marketing.json` works as it is. New: `beats[].screenGuard`, a sentence's own phrases, checked while that
  sentence is on screen. A film that moved its `checkScreen` to the last sentence because a later sentence reveals
  a number can move each number to the sentence that says it.
- A script that records fake voiceovers into a second cache with a copy of `marketing.json`, to rehearse scenes
  before paying, can go: `record <video> --placeholder` (from 0.1.8) does that without touching `voice.cacheDir`.
- `fill` replaces a value already in the field instead of typing after it: over a prefilled `45`, `fill … "50"` now
  records `50` (0.1.8 recorded `4550`). The old value is selected and deleted on screen, with a key sound for each
  key. A field that is empty records frame for frame as before. `"clear": false` keeps 0.1.8's behaviour.
- A new `press` action presses any key (`Backspace`, `Enter`, `Tab`, `Escape`, `ControlOrMeta+A`), `times` times, so
  a scene that shows a deletion key by key or submits with Enter needs no `sceneModule`. A scene module calls
  `d.press(key, { times, perKey })`; a hand-written `Director` needs the new method.

### Upgrading to 0.1.8

- Portrait social posts get their own templates: move a `headline-cta` entry with `size: [1080, 1350]` to
  `big-number` (one figure as the hero) or to a `carousel` slide. `headline-cta` and `headline-chart` render as
  before.
- A 0.1.7 `marketing.json`, its screenshots and the voiceover cache work as they are. New: `scrollTo`, `waitMs` and
  `storageState` on `screenshots[]` entries, `shots --page` for any page, `--placeholder` on `all`/`record`/`render`
  with `voice.placeholder`. An app that kept its own screenshot script for these can drop it.

### Upgrading to 0.1.7

- A batch of voiceovers is one command: `voice a b c --commit` instead of a shell loop. Paid calls are spaced by
  `voice.minIntervalSeconds` (default 60 s); set it to `0` to keep 0.1.6's back-to-back calls.
- A disclosure pasted into every caption moves to `social.disclosure` with `{persona}` for the name; delete it from
  the captions, or the posts carry it twice.

## OG images

`softure-marketing og` renders each `ogImages` entry with [Satori](https://github.com/vercel/satori)
and resvg to `<output.dir>/og/<id>.png`, at `size` (1200×630 for the headline cards and 1080×1350 for the
portrait posts by default), outside Next. The brand
supplies everything around the copy: the background and text colours, the logo and name in the top
corner, and the fonts. `data` is the template's input, checked by its own schema (each template's
fields are in the JSON Schema):

| Template | `data` |
| --- | --- |
| `headline-cta` | `headline` (≤ 90 characters), `eyebrow` (≤ 40), `cta` (≤ 32, a pill in `cta`/`onCta` colours), `tiles` (≤ 4 of `label` ≤ 24, `value` ≤ 16) |
| `headline-chart` | `headline`, `eyebrow`, `tiles` (≤ 3), `chart`: `viewBox` `[width, height]` and `paths` (1-8) of `d` (SVG path data), `tone` (`accent`, `cta`, `foreground`, `muted`), `fill` (a tint instead of a line), `strokeWidth` (view box units) |
| `big-number` | `number` (≤ 12 characters, unit included, e.g. `898 PLN`; shorter numbers get bigger type), `caption` (≤ 90, the sentence under it), `eyebrow` (≤ 40), `tiles` (≤ 2), `cta` (≤ 32), `source` (≤ 80, small at the bottom) |
| `carousel` | `slides` (2-10) of `headline` (≤ 90), `eyebrow` (≤ 40), `body` (≤ 200), `tiles` (≤ 2), `cta` (≤ 32), `source` (≤ 80); `counter` (`true`: `n/N` in the top corner) |

**Social posts.** `big-number` and `carousel` are written for a 1080×1350 portrait post (their default `size`) and
scale by the limiting side, so `"square"` and `"story"` hold the same copy. The logo and name sit on top, the copy
fills the middle, the call to action and the source line are pinned to the bottom. A carousel entry writes one file
per slide, `<output.dir>/og/<id>-1.png`…`<id>-<n>.png`, with a shared look; an `ogImages` id that a slide's file
would also take is refused. The limits are what the post holds: copy at every limit stays inside the frame's margin
(a test renders it and checks the pixels), and a word too long for the line is broken rather than run past the edge.

Values the app computes, such as a chart or a projected date, are computed by the app and arrive in
`data` as numbers, text or SVG paths; the package only draws them.

**Fonts.** Satori reads static `.ttf`, `.otf` and `.woff` files only, so OG images refuse a `.woff2`
file or a variable range (`"100 900"`) in `brand.fonts`, by its JSON path; add a static file for OG
next to it. Templates ask for a weight (the headline for 700, the copy for 400 and 600) and get the
nearest one the brand loads, so a card never names a weight that is not loaded (Satori would draw
another one silently). Satori draws nothing, or an empty box, for a character no font maps, so a
card is checked before layout: a character of the copy (or of `brand.name`) that none of the fonts
Satori would try has is refused with the image id, the JSON path and the characters, e.g.
`ogImages[0].data.headline: "…" (U+0105)` for a Polish letter with a `latin` subset file.
Subset files work: list `latin` and `latin-ext` (or more) for each weight, as Fontsource ships them,
and a text tries them in the order listed, then the other family. Satori uses one file per family,
weight and style, so the second file of a weight and style is registered as the family `<family> #2`
(the third as `#3`) and templates write `font-family: <family>, <family> #2`; `unicodeRange` does
not steer this, the first listed file that has the character draws it. A subset file must exist at
every weight the copy uses: a letter only a `latin-ext` file of another weight has would come out
lighter or heavier than its line, so it is refused like a missing one. Whitespace, format characters
and variation selectors are not checked; emoji are, and need a font that has them.

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
renders without a `marketing.json` at all. For a carousel, pass `slide` (1-based) to either function;
`countOgSlides(template, data)` says how many there are.

## Requirements

- Node 22, **ffmpeg** in PATH.
- A Chromium for the recording and the screenshots: Playwright's own, or `PLAYWRIGHT_CHROMIUM_PATH=<path>`.
- A Chrome for hyperframes: downloaded on the first render (into `~/.cache/hyperframes/chrome`; an older
  `~/.cache/puppeteer/chrome-headless-shell` is still used when it is there), or `HYPERFRAMES_BROWSER_PATH=<path>`
  (a Chromium headless shell works).
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
- Two OG templates.

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
