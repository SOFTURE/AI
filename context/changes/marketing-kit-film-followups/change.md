---
change_id: marketing-kit-film-followups
title: "A committed marketing.json reproduces a paid film without hand fixes"
status: new
roadmap_item: MK-10
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

An app that adopts `@softure-ai/marketing-kit` gets a finished film from `softure-marketing all <video>` with no
hand work after it, and gets the same film again in any later month from its committed `marketing.json` and
voiceover cache. Concretely, when this change is done: the opening transition is chosen in the config and none of
the choices flickers; the voiceover cache tells a reader which file belongs to which video; and the day the app is
recorded as of lives in the config, so a re-render never fails the screen guard just because the calendar moved.
Recordings already paid for (FIRE_TRACKER's `c8768bdc535d185d`) stay valid without a new ElevenLabs call.

## Context

Source: FIRE_TRACKER BS-18 (`marketing-kit-adoption`, archived in FIRE_TRACKER's
`context/archive/2026-10-06-marketing-kit-adoption/`), the first real film made with marketing-kit 0.1.2:
"Ania counts her date" (Polish title), 65.1 s, 1080×1920, paid voiceover `c8768bdc535d185d`.

> "File it with SOFTURE as an active change." — Jarek (owner), 2026-10-06, translated from Polish

Three gaps found there:

1. **The opening rewind flickers and cannot be switched off.** `compose.js` hard-codes `REWIND = 0.8`;
   `render.js` takes `rewindFrames(first, still, 24)` (24 frames spread over the whole scene, about 40 s of the
   wizard in FIRE's film) and encodes them with `tmix=frames=3`. Every frame is a different screen and three are
   blended at once, so the 0.8 s reads as flashing, ghosted screens. The owner, after watching the film:

   > "At 5–6 s something broke and the film flickers, it looks weird." — Jarek (owner), 2026-10-06, translated
   > from Polish

   FIRE fixed the delivered MP4 by hand: a frame before and a frame after the rewind window (5.404–6.204 s, read
   from `<video id="rewind">` in the build's `index.html`), `xfade=transition=fade:duration=0.8`, overlaid with
   `overlay=enable='between(t,5.404,6.204)'`, audio copied. The recipe is in FIRE_TRACKER's
   `marketing/README.md`. Every new `all`/`render` brings the rewind back.

2. **The voiceover cache is flat and unreadable.** `getVoiceoverPaths` in `src/voice/cache.ts` stores
   `<cacheDir>/<key>.mp3` and `<key>.json`, where the key hashes text, voice, model and language. Apps commit these
   files (they are paid), but a folder of hashes says nothing about which video a file belongs to, and a stale
   recording cannot be told from the live one. The owner asked whether the names and folders can be better. A
   rename in the app is not possible today: the lookup is by file name, so renaming loses the cache and costs a
   new recording.

3. **The recording day lives only in a CLI flag.** A paid voiceover says date-dependent numbers (FIRE's: the exit month
   "April 2040" and "in 13 years 6 months"). `record` already freezes the page clock (`page.clock.install`) and accepts
   `--today=YYYY-MM-DD` (`src/cli/options.ts`, `src/record/record.ts`), but nothing in `marketing.json` records the
   day, so after the month changes a plain `all` stops with exit 2 and the reader has to know the flag and the day.
   FIRE's agent first wrote "this voiceover only renders in October 2026" before finding the flag.

## Constraints

- Owns: `tools/marketing-kit/src/compose/`, `src/render/`, `src/voice/cache.ts` (and its callers),
  `src/config/` (schema and `schema/*.json`), `src/cli/`, the package README and `examples/`.
- Backward compatible: a 0.1.2 config keeps working; an existing flat cache (`<key>.mp3`/`.json`) is still found.
- No paid call in tests or CI: the fake provider and fixture recordings only.
- The package version bumps; the owner publishes (run-wide order). MK-8 (first npm publish) is not a prerequisite.
- FIRE_TRACKER is read only from this repo (run-wide order); its adoption of the new version is FIRE's own change.

## Notes

- Decision (auto): placement → **work now**, main roadmap `deploy-followups`, ID **MK-10** (owner: an active
  change; MK is the package's prefix; MK-9 was taken and dropped on 2026-10-03, so it is not reused). Not a DF
  item: the gaps were found in FIRE's adoption, not while delivering this roadmap.
- Decision (auto): one change for three gaps, because they share one outcome (a committed config reproduces a paid
  film) and the same files (`config` schema, `cli`, `render`).
- Open for research: whether the rewind is repaired or replaced (default stays `rewind` vs becomes `fade`); the
  cache layout (per-video folder vs readable prefix plus key) and whether stale keys get a `prune`/listing command.
- Related: GitHub issue #118 lists the gaps from the same adoption's earlier phases (ad-hoc screenshots, scroll
  frame, authenticated screens, README fixes, a renderable dry-run voiceover); they are not part of this change.
