---
project: "SOFTURE AI"
roadmap: marketing-kit
version: 1
status: ready
prd_version: 1
created: 2026-10-02
updated: 2026-10-03
backlog: context/backlog/roadmap-marketing-kit/
---

# Roadmap marketing-kit: videos, screenshots and OG images from a JSON file and a brand

> Entries: [`context/backlog/roadmap-marketing-kit/`](../backlog/roadmap-marketing-kit/). An entry is taken
> (moved to `context/changes/<id>/`) when its item starts.
> Reference: [`docs/03-marketing-kit.md`](../../docs/03-marketing-kit.md), PRD FR-24 and FR-25.
>
> Promoted by the owner on 2026-10-03, when the monetization roadmap closed (archived in
> [`archive/2026-10-03-3-roadmap.md`](archive/2026-10-03-3-roadmap.md)). EN-9 (engagement release) and MO-6
> (monetization release) are carried over here as blocked owner items: the owner publishes them in one batch at
> the keyboard on Monday 2026-10-05.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Owner at the keyboard: EN-9 and MO-6 (carried over), MK-8 (first publish and trusted publisher).
>
> FIRE_TRACKER adoption (owner, 2026-10-03): no item here adopts the modules in FIRE_TRACKER. The adoption
> runs in FIRE_TRACKER's own roadmap and sessions once this repository reports the code ready; this
> repository delivers the modules and their release.
>
> Queued after this one (WORKFLOW §5.1, files in `roadmaps/`, entries in `context/backlog/`):
> 1. [`roadmap-later`](roadmaps/roadmap-later.md): items parked until an owner step (secrets, accounts) is done.
> 2. [`roadmap-followups`](roadmaps/roadmap-followups.md): the catch-all for gaps found in every roadmap; promoted last.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **EN-9** | `engagement-release` | mailing, waitlist, mcp-access and privacy 0.1.0 published through the release pipeline; READMEs and docs updated | EN-1…EN-8 (done) | owner | blocked (carried over from monetization: the owner's batch release at the keyboard on 2026-10-05) |
| **MO-6** | `monetization-release` | billing and analytics 0.1.0 published through the release pipeline; READMEs and docs updated | MO-1…MO-5 (done) | owner | blocked (carried over from monetization: the owner's batch release at the keyboard on 2026-10-05) |
| **MK-1** | `mk-core-port` | FIRE's video pipeline (voiceover cache, timeline, recorder/Director, compose, render, posts) runs from `tools/marketing-kit` with its tests, config still FIRE-shaped | — | autonomous | done |
| **MK-2** | `mk-config-contract` | `marketing.json` + brand validated by zod, published as JSON Schema; every hard-coded constant becomes config; `design.json` import | MK-1 | autonomous | done |
| **MK-3** | `mk-declarative-actions` | scenes described as JSON actions with locator descriptors; `sceneModule` TS escape hatch kept | MK-2 | autonomous | ready |
| **MK-7** | `mk-tts-adapters` | `TtsProvider` interface, ElevenLabs adapter, cache key includes voice, model and language; paid calls only with `--commit` | MK-2 | autonomous | ready |
| **MK-6** | `mk-formats` | 1:1 and 16:9 render formats next to 9:16, geometry from config | MK-2 | autonomous | done |
| **MK-4** | `mk-screenshots` | `softure-marketing shots` with quality gates (HTTP status, expected phrase, minimum size, full-page scroll) | MK-2 | autonomous | ready |
| **MK-5** | `mk-og-images` | OG images rendered with Satori outside Next from templates + data | MK-2 | autonomous | ready |
| **MK-8** | `marketing-kit-release` | `@softure-ai/marketing-kit` 0.1.0 published through the FD-2 pipeline, README complete | MK-3, MK-4, MK-5, MK-6, MK-7 | owner | ready |

## Order

1. **MK-1 alone.** It owns `tools/marketing-kit/` as a whole while the code moves in. A faithful
   port first: behaviour is proven by FIRE's own tests before anything is generalised.
2. **MK-2 alone.** It owns `tools/marketing-kit/src/config/` and `schema/`, and it touches every
   module that read a constant.
3. **Then in parallel, after MK-2:**
   - MK-3 owns `src/record/` (actions, Director);
   - MK-7 owns `src/voice/`;
   - MK-4 owns `src/screenshot/`;
   - MK-5 owns `src/og/`.

   MK-6 owns `src/compose/` and `src/render/` geometry. It runs alongside the others, except MK-3,
   if MK-3 needs compose changes. Assign `src/compose/` to MK-6 and keep MK-3 to recording.
4. **MK-8** once all features are merged.
5. **EN-9 and MO-6** (owner, carried over) any time: they need no item of this roadmap.

Risk first: MK-1 proves the port is faithful. MK-2 fixes the contract every later item builds on.

## Items

### EN-9: Engagement modules release (carried over)
- **Change ID:** `engagement-release`
- **Status:** blocked (carried over from monetization: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:** `@softure-ai/mailing`, `@softure-ai/waitlist`, `@softure-ai/mcp-access` and `@softure-ai/privacy` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across EN-1…EN-8.
- **Prerequisites:** EN-1…EN-8 (done, see [`archive/2026-10-03-2-roadmap.md`](archive/2026-10-03-2-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### MO-6: Monetization modules release (carried over)
- **Change ID:** `monetization-release`
- **Status:** blocked (carried over from monetization: the owner's batch release at the keyboard on 2026-10-05)
- **Outcome:** `@softure-ai/billing` and `@softure-ai/analytics` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across MO-1…MO-5.
- **Prerequisites:** MO-1…MO-5 (done, see [`archive/2026-10-03-3-roadmap.md`](archive/2026-10-03-3-roadmap.md)).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### MK-1: Port the FIRE video core
- **Change ID:** `mk-core-port`
- **Status:** done
- **Input:** [`archive/2026-10-03-mk-core-port/change.md`](../archive/2026-10-03-mk-core-port/change.md)
- **Outcome:** `tools/marketing-kit` contains the FIRE_TRACKER pipeline, ported 1:1 with its tests:
  - `voiceover` (cache by content hash, word timings);
  - `timeline` (beats, caption chunking);
  - `record` (frame-by-frame Playwright, frozen clock, Director DSL, screen guard);
  - `compose` (HTML composition: phone frame, camera, captions, persona card, hook, end card);
  - `render` (ffmpeg + pinned hyperframes);
  - `posts`;
  - a CLI `softure-marketing <all|voice|record|render|preview|posts>` with preflight (ffmpeg, hyperframes).

  Config may still be FIRE-shaped. Paths resolve relative to a config file, not the repo.
- **Prerequisites:** FD-1, FD-2 (roadmap trigger).
- **Unknowns:**
  - Which tests depend on the FIRE app itself (site-token parsing of `globals.css`, channel tags) and how to stub them.
  - Whether GSAP and hyperframes can be npm dependencies with no files copied into the package (GSAP is under its own no-charge license, hyperframes is Apache-2.0).
- **Risk:** medium. ~2.5k LOC with external binaries (ffmpeg, Chromium).
- **Baseline:** FIRE `video/**` tests (film, timeline, voiceover, compose, posts, site tokens). After: the same tests are green in the package, and a fixture film renders a draft MP4 in CI or locally.
- **PRD refs:** FR-24, NFR-1, NFR-2.

### MK-2: Config contract: marketing.json and brand
- **Change ID:** `mk-config-contract`
- **Status:** done
- **Input:** [`archive/2026-10-03-mk-config-contract/change.md`](../archive/2026-10-03-mk-config-contract/change.md)
- **Outcome:** a zod schema for `marketing.json` (brand, app, voice, videos, social, screenshots, ogImages, output), published as `schema/marketing.schema.json`. Every FIRE hard-coded constant (about 20) becomes config:
  - default URL, port and start command;
  - hidden selectors;
  - locale and timezone;
  - TTS language and default voice;
  - fonts and logo;
  - caption colours;
  - platforms and the channel link template;
  - geometry.

  The brand can come inline or from an Impeccable `design.json`. Validation errors name the JSON path. Messages are in English.
- **Prerequisites:** MK-1.
- **Unknowns:**
  - Which `design.json` roles map to the brand colour roles.
  - Whether FIRE's TS film modules convert to JSON losslessly apart from scenes (scenes are MK-3).
- **Risk:** medium. This is the contract every later item builds on.
- **Baseline:** constants grep in MK-1 output. After: zero product-specific literals in `src/` (architecture test), and the example config validates.
- **PRD refs:** FR-24, NFR-6.

### MK-3: Declarative scene actions
- **Change ID:** `mk-declarative-actions`
- **Status:** ready
- **Outcome:**
  - Beats carry an `actions` list (`wide`, `tap`, `type`, `fill`, `blur`, `focus`, `bring`, `mark`, `still`, `cue`, `hold`, `until`, `checkScreen`). The list maps 1:1 to Director methods.
  - Targets use locator descriptors: `{role,name}`, `{text,exact,nth}`, `{label}`, `{testId}`, `{css}`, or an array meaning a union.
  - `sceneModule` remains as a TS escape hatch.
  - The FIRE example film expressed in JSON records the same log (beats, taps, marks) as its TS version.
- **Prerequisites:** MK-2.
- **Unknowns:** whether conditional waits in FIRE's film need anything beyond `until(word)`; how to report a failing locator with its JSON path.
- **Risk:** medium.
- **Baseline:** FIRE film recording log (`RecordingLog`). After: the JSON version produces an equivalent log (same beats, marks and stills; frame counts within tolerance).
- **PRD refs:** FR-24.

### MK-7: TTS provider adapters
- **Change ID:** `mk-tts-adapters`
- **Status:** ready
- **Outcome:**
  - A `TtsProvider` interface (text in; audio plus word timings out) and an ElevenLabs adapter (key from `ELEVENLABS_API_KEY`).
  - The cache key covers text, voice, model and language. FIRE's key had the language hard-coded; existing caches stay readable through a documented migration.
  - Paid calls run only with `--commit`, and the cost estimate is printed before any call.
- **Prerequisites:** MK-2.
- **Unknowns:**
  - Whether the FIRE cache files can be re-keyed without new paid calls.
  - A second provider worth stubbing for tests (a fake provider is mandatory).
- **Risk:** low.
- **Baseline:** FIRE voiceover tests. After: the same tests run through the interface with a fake provider; no network in CI.
- **PRD refs:** FR-24.

### MK-6: Render formats 1:1 and 16:9
- **Change ID:** `mk-formats`
- **Status:** done
- **Input:** `context/archive/2026-10-03-mk-formats/`
- **Outcome:**
  - `format` per video: `9:16`, `1:1` or `16:9`.
  - Frame size, device viewport placement, camera targets and caption layout come from a geometry table, not constants.
  - The end card and persona card adapt per format.
- **Prerequisites:** MK-2.
- **Unknowns:** whether 16:9 needs a desktop viewport recording or a framed phone; how captions wrap in 1:1.
- **Risk:** low.
- **Baseline:** 9:16 output of MK-1 (composition snapshot). After: snapshots for all three formats, and 9:16 is unchanged.
- **PRD refs:** FR-24.

### MK-4: Screenshots with quality gates
- **Change ID:** `mk-screenshots`
- **Status:** ready
- **Outcome:** `softure-marketing shots` renders the `screenshots` entries of `marketing.json`. Options cover width, height, full page with a lazy-load scroll, and motion reduce/no-preference. It applies the FIRE gates:
  - HTTP status below 400;
  - the expected phrase is present;
  - the file is at least 40 kB, and smaller output is deleted.

  Flags and messages are in English.
- **Prerequisites:** MK-2.
- **Unknowns:** whether a shared app-start helper with the recorder (`app.startCommand`) is enough for both.
- **Risk:** low. FIRE's `scripts/screenshot.mts` is almost package-ready.
- **Baseline:** FIRE screenshot script behaviour. After: the same gates, covered by tests against a static fixture page.
- **PRD refs:** FR-25.

### MK-5: OG images outside Next
- **Change ID:** `mk-og-images`
- **Status:** ready
- **Outcome:**
  - `softure-marketing og` renders `ogImages` entries with Satori to PNG, at 1200×630 by default.
  - Templates take `data`, for example `headline-cta` with headline, CTA and tiles.
  - Fonts and palette come from the brand.
  - Values computed by the app (charts) arrive precomputed in `data` (numbers or SVG paths).
  - Apps can keep a thin Next route that calls the package.
- **Prerequisites:** MK-2.
- **Unknowns:** whether `satori` + `@resvg/resvg-js` reproduce FIRE's current cards closely enough; font loading rules (only weights that are actually loaded, as FIRE's OG tests require).
- **Risk:** low.
- **Baseline:** FIRE OG card tests (`og-card`, `og-palette`). After: equivalent tests on templates, and a PNG snapshot per template.
- **PRD refs:** FR-25.

### MK-8: marketing-kit release
- **Change ID:** `marketing-kit-release`
- **Status:** ready
- **Outcome:**
  - `@softure-ai/marketing-kit` 0.1.0 is published through the FD-2 pipeline. The owner approves the first, staged publish and configures the trusted publisher.
  - The README lists system requirements (ffmpeg, Chromium, hyperframes), the full config reference, and the license notes: GSAP as a dependency, no bundled SFX or fonts.
  - An example `marketing.json` and brand ship in `examples/`.
- **Prerequisites:** MK-3, MK-4, MK-5, MK-6, MK-7.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** package absent from npm. After: `npx @softure-ai/marketing-kit --help` works from npm and from the GitHub Release tarball.
- **PRD refs:** FR-24, FR-25, FR-2.

## Owner decisions and checks

- [ ] **EN-9** (carried over): approve the first (staged) publish of mailing, waitlist, mcp-access and privacy on
  npmjs.com, then add a trusted publisher for each (batch on 2026-10-05).
- [ ] **MO-6** (carried over): approve the first (staged) publish of billing and analytics on npmjs.com, then add a
  trusted publisher for each (batch on 2026-10-05).
- [ ] **MK-8**: approve the first (staged) publish of `@softure-ai/marketing-kit` on npmjs.com, then add its trusted publisher.

## Done

- **MK-1** `mk-core-port`: `@softure-ai/marketing-kit` runs FIRE's video pipeline (`softure-marketing all|voice|record|render|preview|posts`) from `marketing.config.json`, FIRE's tests pass in the package, a fixture film renders a draft MP4 locally; archived in `archive/2026-10-03-mk-core-port/`
- **MK-2** `mk-config-contract`: one `marketing.json` (brand, app, voice, videos, social, screenshots, ogImages, output) validated by zod and published as `schema/marketing.schema.json`; brand colours inline, from the app's stylesheet or a `design.json`; errors name the JSON path; no FIRE constant left in `src/` (architecture test); archived in `archive/2026-10-03-mk-config-contract/`
- **MK-6** `mk-formats`: `videos[].format` renders 9:16, 1:1 or 16:9 from one recording; frame, phone, camera target, captions, persona and end card come from a per-format geometry table; 9:16 byte-identical to the baseline snapshot; desktop 16:9 and layout overrides deferred (FU-15, FU-16); archived in `archive/2026-10-03-mk-formats/`

## Decisions (auto)

- MK-1 is a faithful port before any generalisation. → FIRE's tests prove behaviour while the code moves; generalising and moving at once would hide regressions.
- MK-7 (TTS adapters) was split out of MK-2. → The cache-key change needs its own migration of FIRE's committed cache.
- MK-6 owns `src/compose/`, and MK-3 stays in `src/record/`. → It keeps the parallel group disjoint.
- Table order follows execution, not number. → MK-7 and MK-6 come before MK-4 and MK-5 because they touch the core path, and IDs stay stable.
- EN-9 and MO-6 are carried over from monetization as blocked owner items (owner, 2026-10-03). → The batch release
  at the keyboard on 2026-10-05 must not hold this roadmap back.
- MK-9 (FIRE_TRACKER adoption) was dropped by the owner on 2026-10-03. → The adoption runs in FIRE_TRACKER's own
  roadmap and sessions; paid TTS there stays with the owner's `--commit`.
