# 03 — `@softure-ai/marketing-kit`: marketing materials generator

A project supplies a **brand** (colors, fonts, logo) and a **`marketing.json`** (videos, scenes,
voiceover, screenshots, OG images, posts). The package generates the finished files. The source
is FIRE_TRACKER: `video/**` (~1.9k LOC plus tests), `scripts/screenshot.mts` and
`src/app/**/opengraph-image.tsx`.

## What FIRE has today (3 independent generators)

| Generator | How it works | Package readiness |
|---|---|---|
| **Video** (`npm run video`) | preflight → **voice** (ElevenLabs `with-timestamps`, mp3+JSON cache keyed by sha256 of the content) → **record** (Playwright chromium frame by frame, 390×844@3×, frozen clock, CSS animations stepped) → **render** (ffmpeg → HTML composition + GSAP → `npx hyperframes render` → MP4 1080×1920) → **posts** (IG/FB/TikTok captions) | generic core, ~20 hard-coded things (URL, port, `next dev`, language, fonts, colors parsed from `globals.css`, logo, platforms, 9:16 only) |
| **Screenshots** (`npm run shot`) | Playwright with gates: HTTP < 400, a required phrase, file ≥ 40 kB, `--full` scrolls to load lazy images | almost ready, flag names need translating |
| **OG** | Next `ImageResponse` (Satori) 1200×630, TTF fonts, palette as constants | tightly bound to Next and to the domain (numbers from the FIRE engine) |

A video is a **TS module** today (`video/films/<id>.ts`) using a `Director` DSL:
`beat`, `until(word)`, `tap`, `fill`, `focus`, `wide`, `mark`, `still`, `cue`, `checkScreen`.
TS was a deliberate choice (Playwright locators, typo-checked ids).

## Package architecture

```
tools/marketing-kit/
  schema/marketing.schema.json   JSON Schema (generated from zod), the contract for projects and agents
  src/
    config/       load marketing.json + brand (or .impeccable/design.json) + validation
    voice/        TtsProvider interface (estimate + synthesize); ElevenLabs and fake adapters; cache by hash(text, voice, model, language)
    record/       frame-by-frame recording (Playwright), Director, declarative JSON actions → Director calls
    compose/      HTML composition (phone, camera, word-level captions, persona card, hook, end card)
    render/       ffmpeg + hyperframes (npm dependency, Apache-2.0), formats 9:16 / 1:1 / 16:9
    screenshot/   screenshots with quality gates
    og/           Satori/@vercel/og outside Next: templates + data
    posts/        per-platform captions with channel links
  examples/       sample marketing.json + brand
```

CLI: `softure-marketing <all|voice|record|render|preview|shots|og|posts> [--film id] [--commit] [--quality draft|standard|high]`.
The FIRE rule stays: **paid steps (TTS) run only with `--commit`**, and the voiceover cache is
committed to the project repository.

## `marketing.json` contract

The contract is fixed by MK-2: the zod schema in `tools/marketing-kit/src/config/schema.ts`, published as
[`schema/marketing.schema.json`](../tools/marketing-kit/schema/marketing.schema.json), with the reference
in the [package README](../tools/marketing-kit/README.md#marketingjson). The sketch below is the
original draft: beat `actions` and `role` are still to come (MK-3), and the final key names differ in
places (`brand.timezone`, `app.device`, `voice.cacheDir`, `social.platforms.<p>.code`, `sfx`).

```jsonc
{
  "$schema": "https://unpkg.com/@softure-ai/marketing-kit/schema/marketing.schema.json",
  "brand": {
    "name": "Acme Plan",
    "logo": { "svg": "./brand/mark.svg" },
    "colors": { "background": "#0c0c0d", "surface": "#17181a", "foreground": "#f2f3f5", "muted": "#a3a6ad",
                "accent": "#cff26b", "onAccent": "#0c0c0d", "captionBg": "#ecf1f7", "captionText": "#0c0c0d", "captionHighlight": "#356912" },
    "fonts": { "heading": { "family": "Ubuntu", "files": { "700": "./fonts/ubuntu-700.ttf" } },
               "body":    { "family": "Ubuntu", "files": { "400": "./fonts/ubuntu-400.ttf" } } },
    "tokensFrom": { "designJson": ".impeccable/design.json", "theme": "dark" },
    "locale": "en-US", "timezone": "Europe/London"
  },
  "app": { "baseUrl": "http://localhost:3000", "startCommand": "npx next dev -p {port}", "port": 3100,
           "hideSelectors": ["nextjs-portal"], "colorScheme": "dark", "today": "2026-09-29" },
  "voice": { "provider": "elevenlabs", "voiceId": "…", "model": "eleven_multilingual_v2", "language": "en", "tempo": 1.1,
             "cacheDir": "marketing/voiceover" },
  "videos": [{
    "id": "anna-calculator", "path": "/calculator", "format": "9:16",
    "device": { "viewport": [390, 844], "scale": 3, "mobile": true },
    "persona": { "name": "Anna", "subtitle": "36 years old", "tagline": "…" },
    "beats": [
      { "id": "hook", "role": "hook", "text": "…" },
      { "id": "assets", "text": "…", "actions": [
          { "do": "wide" },
          { "do": "tap", "target": { "role": "button", "name": "^Next$" }, "after": 0.25 },
          { "do": "fill", "input": "accessible", "value": "525000" },
          { "do": "until", "word": "savings" },
          { "do": "focus", "target": { "text": "Your wealth today" }, "scale": 1.4, "height": 230 } ] },
      { "id": "cta", "role": "endCard", "text": "…", "pad": 1.4 }
    ],
    "hook": { "still": "result", "shots": [{ "mark": "exit-age", "scale": 1.75 }] },
    "screenGuard": ["March 2040", "49 years"],
    "endCard": { "headline": "Find your date", "url": "example.com/calculator", "note": "…" },
    "sfx": { "tap": "./sfx/click.mp3" },
    "sceneModule": null
  }],
  "social": { "linkTemplate": "https://example.com/calculator?z={code}",
              "platforms": { "instagram": { "code": "ig-01", "linkInBio": true }, "facebook": { "code": "fb-01" } },
              "posts": [{ "video": "anna-calculator", "caption": "…", "hashtags": ["fire"] }] },
  "screenshots": [{ "id": "landing-desktop", "path": "/", "width": 1440, "height": 900, "full": true, "expect": "…", "motion": "reduce" }],
  "ogImages": [{ "id": "calculator", "size": [1200, 630], "template": "headline-cta", "data": { "headline": "…", "cta": "…" } }],
  "output": { "dir": "marketing/out", "quality": "standard" }
}
```

- `target` is a locator descriptor: `{role,name}` | `{text,exact,nth}` | `{label}` | `{testId}` | `{css}`.
  An array means a union.
- **`sceneModule`** is the TS escape hatch. When a scene needs logic, the project supplies a module
  with `scene(d: Director)`, as FIRE does today.
- OG images with domain-computed data (e.g. the FIRE chart): the project passes precomputed values
  or SVG paths in `data`.

## Licenses and assets (important for a public package)

| Asset | License | How the package handles it |
|---|---|---|
| hyperframes (renderer) | Apache-2.0 | npm dependency (not vendored), pinned version |
| GSAP | GreenSock's own "no-charge" license, not OSI | **npm dependency** `gsap`, not copied into the package |
| Pixabay SFX (copied into FIRE today) | Pixabay Content License: no standalone redistribution | **not bundled**. The project supplies its own SFX; the package may ship a CC0 set |
| Geist/Newsreader (OFL) and Ubuntu (UFL) fonts | OFL/UFL | **not bundled**; fonts come from the project's brand |
| ElevenLabs | paid API | key from env (`ELEVENLABS_API_KEY`), swappable adapter |
| satori, @resvg/resvg-js (OG images) | MPL-2.0 | npm dependencies, unmodified |

## Machine requirements

ffmpeg in PATH, Chromium for Playwright and Chrome for hyperframes (~200 MB on first run).
The package checks these in a preflight step, as FIRE does.

## Order of work

1. Move the core 1:1 from FIRE (voiceover, timeline, recorder, compose, posts, screenshot) together with its tests.
2. Move every constant into `marketing.json`/brand (~20 items, listed in the assessment).
3. Add declarative actions (JSON → Director) and the JSON Schema.
4. OG generator outside Next (Satori), plus the 1:1 and 16:9 formats.
5. FIRE deletes `video/`, keeps `marketing.json` + brand + voiceover cache, and verifies an identical MP4.
