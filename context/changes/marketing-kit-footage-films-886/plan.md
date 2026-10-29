---
change_id: marketing-kit-footage-films-886
status: in_progress
---

# Plan: footage films (issue #886)

Input: change.md, research.md. Complexity: large (a new module of the package, config, CLI, fixture, CI job step).
All new code lives in `tools/marketing-kit/src/footage/`; the screen film's files change only where a shared
helper is exported.

## Phase 1: model, probe, normalize (TDD on the pure parts)

Files: `src/footage/film.ts`, `probe.ts`, `normalize.ts`, tests beside them.

- `FootageFilm`, `FootageClip` (`id`, `source` path or URL, `role: talk | broll`, `fit: blur | crop | auto`,
  `trim`, `script` for the placeholder), `MusicSource` (`none | file | prompt | video`), cut and transition options.
- `readFootageProbe(json)`: ffprobe JSON (unknown, narrowed with zod) to duration, coded and displayed size,
  rotation (display matrix or `rotate` tag), codec, transfer, HDR kind (`pq | hlg | dolby-vision | null`), audio.
  `findFootageProblems`: no video, too short, a trim outside the clip. `probeFootage(files)` runs ffprobe.
- `buildNormalizeArgs`: ffmpeg arguments for 30 fps at the format's frame (1080×1920, 1080×1080, 1920×1080),
  upright (autorotate), HDR tone-mapped to BT.709 with zscale + tonemap, `crop` or `blur` fill (auto: crop when the
  aspect is within 15 % of the frame's), 48 kHz stereo AAC (silence for a clip without audio), keyframe every 0.5 s.
- Tests: rotation from both sources, PQ, HLG, Dolby Vision, an audio-less clip, problems; argument shapes.

## Phase 2: paid providers and cache

Files: `src/footage/providers.ts` (interfaces, estimates), `elevenlabs.ts`, `fake.ts`, `cache.ts`, tests.

- `SttProvider.transcribe`, `IsolationProvider.isolate`, `MusicProvider.compose` and `.scoreVideo`, results as
  values. ElevenLabs: Scribe (`scribe_v2`, word timestamps, language), Voice Isolator, Music, Video to Music, each
  with an injected `fetch`; `readScribeResponse` keeps `type: word` entries.
- A free estimate per paid step in seconds of audio or music; the pipeline prints it and calls a provider only with
  `isCommit`.
- Content-keyed cache under `<cacheDir>/<film>/`: `<key>.transcript.json`, `<key>.isolated.mp3`,
  `<key>.music.mp3`; the key hashes the input bytes and the settings, so a re-render never pays twice.
- Fake providers for tests; `makePlaceholderTranscript(script, duration)` for `--placeholder`.

## Phase 3: EDL, word remap, ducking

Files: `src/footage/edl.ts`, `music.ts`, tests.

- `buildEdl(clips, options)`: talk clips keep runs of spoken words, fillers removed (per-language defaults `pl`,
  `en`, compared with repeated letters collapsed), pauses over `pauseSeconds` cut, `padSeconds` around each cut,
  `maxSeconds` honoured; b-roll keeps its whole clip with a Ken Burns move; transitions by cut kind (`jump`,
  `clip`), overridable per segment. `edlSchema` validates a hand-edited file; `checkEdl` against the clips.
- `remapWords(edl, transcripts, fillers)`: film-time words for the captions.
- `duckingKeyframes` and `volumeExpression` (sum of linear pieces for ffmpeg's `volume`).
- Tests: filler and pause cutting, padding and merging, max length, remap after a cut, keyframes and expression.

## Phase 4: composition, render, library entry

Files: `src/footage/compose.ts`, `render.ts`, `pipeline.ts`, `src/compose/html.ts` (escape, font faces, shared
with `compose.ts`), `src/index.ts`.

- `composeFootage`: one `<video>` per segment, `fade` (0.3 s cross-fade), `zoom` (punch-in alternating on jump cuts),
  `whoosh` (cut + whoosh sound), Ken Burns on b-roll, captions with the word highlight, end card over the last frame,
  one speech track and one pre-ducked music track.
- `render.ts`: speech track (atrim + concat with 20 ms fades), ducked music, last frame, assets, hyperframes render.
- `pipeline.ts`: `prepareFootage`, `transcribeFootage`, `cutFootage`, `renderFootage`, `renderFootageFilm(film,
  options)`; the EDL is written next to the build and reused when present (`cut` rewrites it); the placeholder run
  has its own EDL, transcripts in the build folder and the `.placeholder.mp4` name.

## Phase 5: config and CLI

Files: `src/config/schema.ts`, `config.ts`, `src/cli/options.ts`, `main.ts`, `footage.ts`, `schema/`.

- `footage[]` in `marketing.json` (ids unique across `videos` and `footage`, `videos` may be empty when footage is
  set), `social.posts` may name a footage film; regenerated JSON Schema.
- `softure-marketing footage <video> [--step=transcribe|cut|render] [--commit] [--placeholder] [--quality=]`.

## Phase 6: fixture, render test, docs

- `examples/fixture`: a footage film; `prepareFootageFixture` generates CC0 clips with ffmpeg (a portrait talking
  clip with rotation metadata and a tone, a landscape b-roll, an HDR-tagged clip).
- `tests/render.test.ts`: probes the generated clips (rotation, HDR detected), renders the footage film with
  `--placeholder` and checks size, audio and length; runs in the CI render job.
- README section, CHANGELOG `## Unreleased`, `docs/03-marketing-kit.md` note.

## Decisions (auto)

- Footage films are a top-level `footage` array, not `videos` entries (research, option 2).
- Ducking is applied by ffmpeg to the music file from computed keyframes; the composition plays the ducked track.
- Steps run alone through `--step=` rather than positional subcommands, so a video named `cut` stays addressable.
- Fixture clips are synthetic, generated by ffmpeg at test time (our own work, CC0), so no binary enters the
  repository and no third-party licence applies.
- No version bump: the coordinator releases the wave (marketing-kit minor, 0.3.0 per the issue).
- `videos` stays required in the input but may be empty when `footage` has a film (making it optional would change
  `MarketingJsonInput` for every project that types its config); `app` stays required, so a footage-only consumer
  without an app uses the library entry.
- The paid footage cache shares `voice.cacheDir` (`<cacheDir>/<film>/<key>.transcript.json|isolated.mp3|music.mp3`).
- Estimates are seconds of audio or music billed: the ElevenLabs reference pages give no per-call price.
- Generated music for a prompt is keyed by the prompt (not the cut's length) and looped to the film's length, so a
  re-cut never pays again; Video to Music is keyed by the EDL, since it scores that cut.
- A footage film's post carries no `social.disclosure`: it names a persona and an AI voice, which a filmed person is not.
- The fixture footage film speaks English (the language gate keeps Polish text out of code and fixtures); Polish
  fillers are covered by the EDL unit tests with ASCII words.
- HDR tone mapping returns to 8-bit right after the curve: the blur fill on float frames crashed ffmpeg 6.1.

## Progress

- [x] Phase 1: model, probe, normalize
- [x] Phase 2: providers (ElevenLabs Scribe, Voice Isolator, Music, Video to Music; fakes), cache
- [x] Phase 3: EDL, word remap, ducking
- [x] Phase 4: composition, render, `renderFootageFilm`
- [x] Phase 5: config (`footage[]`) and CLI (`footage --step=`)
- [x] Phase 6: fixture (generated CC0 clips), render test, docs
- [x] Implementation review: approved
