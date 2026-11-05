# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/marketing-kit`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`marketing-kit@x.y.z`).

## Unreleased

- **A failed footage ffmpeg step hands over what it ran (#1063):** `onFfmpegFailure` on `prepareFootage`,
  `transcribeFootage`, `renderFootage`, `renderFootageFilm`, `renderFootageDraft` and `cutFootageFilm` gets an
  `FfmpegFailure` for every failing ffmpeg step inside them, nested ones included (normalize, tone map LUT, cut
  frames, cut preview, speech, music, picture, final pass, cover): `step`, the exact `args` (`-progress` included),
  `cwd`, `code`, `signal`, the whole `stderr` (up to its last 2000 lines) and every `-i` input. The hook runs before
  the step throws and a returned promise is awaited. New export `writeFfmpegFailure(dir, failure, { signal })` writes
  `command.sh` (re-runs the command from its folder, the graph read from `filtergraph.txt`), `filtergraph.txt` (one
  chain per line), `stderr.log` and `inputs.json` (ffprobe of each input). Every failure also writes one `log` line
  with the step and its full command, with or without the hook. The thrown error text is unchanged. Also exported:
  `FfmpegFailure`, `FfmpegFailureHook`, `withFfmpegFailureReporting` and `runFfmpeg`'s `onFailure`, for a direct
  `runFfmpeg` caller; `formatFfmpegCommand`, `splitFilterGraph`, `buildFfmpegFailureScript`, `FFMPEG_FAILURE_FILES`.
  README "Footage films in a worker" says what to keep. Nothing to change for an app that does not pass the hook.

## 0.9.2

- **Drafts and renders with a `fade` work on ffmpeg 7.1 (#1057):** ffmpeg 7.1's `setpts` leaves a stream's frame
  rate unknown (1/0) and `xfade` refused it, so every `renderFootageDraft` and `renderFootage` whose cut has a
  `fade` failed (the footage worker recipe installs 7.1). Every stream into `xfade` now ends with `fps=30` (the
  draft's segments and `concat` joins, both streams of a picture piece); on ffmpeg 6.1 it passes the frames through.
  A fade right after a zoomed segment also failed on every ffmpeg: the zoomed tail came back a pixel or two narrower
  than the clip (1078x1920). It is now scaled back to the clip's frame. `buildPicturePieceArgs` takes a new required
  `frame` (the normalized clips' frame, `getFrame(film)`); an app that calls it directly passes it. Nothing to change
  for an app that only calls `renderFootage` or `renderFootageDraft`.

## 0.9.1

- **A draft render with `crf` keeps its picture (#1051):** the final pass of `renderFootage` copies an H.264 yuv420p
  picture in Constrained Baseline, Main or High (was High only). `quality: "draft"` encodes with libx264
  `ultrafast`, which writes Constrained Baseline, so a `draft` + `crf: 18` render was encoded a second time at
  `medium` and ended slower than `standard`; now it is copied (about 540 s instead of 858 s for the issue's 56.7 s
  film at one CPU). A picture outside those profiles is still re-encoded to High. `findFinishProblems` and the
  finish log line name the profile; new export `PUBLISHABLE_H264_PROFILES`.

## 0.9.0

- **The footage draft looks and sounds like the render (#1050):** `renderFootageDraft` follows the film's
  `captionStyle`: a `highlight` film gets the render's chunks of up to four words on an opaque box of
  `captionBackground`, in `captionText`, the word being said in `captionHighlight` for 0.32 s. New options `brand`
  (the `FootageBrand` the render takes: the body font's TrueType or OpenType file, named by its own family, and the
  caption colours; DejaVu Sans when the font has no such file) and `cacheDir` / `providers`: a `file` music source, or
  generated music already in the paid cache, plays ducked, looped and faded as in the render. The draft never calls a
  provider; the result gains `music` (`"none"`, `"played"`, `"not_cached"`) and `captionFont`, and the log says why
  there is no music. `buildFootageDraftCaptions` takes `film.captionStyle` and `colors`, `buildFootageDraftArgs` takes
  `music`. New exports: `findFootageMusic` (the render's music lookup, now shared), `chooseFootageDraftFont`,
  `readFontFamilyName`, `toAssColor`, `FOOTAGE_DRAFT_CAPTION_COLORS`, `FootageDraftMusic`, `FootageMusicLookup`.
  A call without the new options draws a `phrase` film exactly as before. README "A fast draft before the render":
  what the draft matches and what it leaves out.

## 0.8.0

- **A faster HDR tone map in footage normalize (#1037):** `normalizeFootage` (and so `prepareFootage`) tone-maps an
  HDR clip through a 3D LUT made from the same Hable curve instead of in float: the first HDR clip of a transfer runs
  the float chain once over a 65-point lattice and writes `tonemap-v1-<transfer>.cube` next to the normalized clip
  (about 7 MB, 0.2 s), and every clip then goes to 16-bit R'G'B', through `lut3d` (tetrahedral) to linear BT.709 and
  back to YUV. At one CPU with `ultrafast` a 1080×1920 HEVC 10-bit HLG clip normalizes in about 1.2 s per footage
  second instead of 1.6 s. The look is the float chain's (about 50 to 70 dB PSNR on in-gamut pictures); colours outside
  BT.709 are now clipped per RGB channel instead of in YUV, which keeps their hue. Clips already normalized are not
  made again. `buildNormalizeArgs` takes `toneMapLut` (the LUT's file name, resolved where ffmpeg runs) and keeps the
  float chain without it. `checkFootageTools` also requires `lut3d`. New exports: `ensureToneMapLut`,
  `getToneMapLutName`, `getToneMapTransfer`, `TONE_MAP_LUT_SIZE`, `ToneMapTransfer`. README: normalize time per
  footage second, and two CPUs for 4K HDR footage.

- **The footage render's encoder CRF (#1036):** `RenderFootageOptions.crf` (a whole number from 0 to 51) passes
  hyperframes' `--crf`, overriding the quality tier's CRF; the x264 preset stays the tier's. A one-CPU worker renders
  with `quality: "draft", crf: 18` (`ultrafast` at the published CRF) in about 6.9 s per second of film instead of
  11.7 s with `standard`. hyperframes 0.8.85 has no flag for the preset on its own. README "Footage films in a
  worker" lists the tiers and the trade-off (`draft` also captures JPEG 80).

## 0.7.0

- **Smooth cuts on handheld footage (#1025):** three options, all off by default, so existing films render as before.
  `edit.zoomEaseFrames` (0-15) eases a `zoom` cut into its scale (and back out) from the scale on screen before the
  cut, in `composeFootage` (a `power1.out` tween, on the one picture video too) and in the draft (`zoompan`); `getSegmentZoomEases` gives each
  segment's frames, and `DraftSegmentPlan` gained `startScale` and `easeFrames`. `edit.zoomPercent` now allows up to
  112. `edit.cutAudioFadeMs` (10-100, default 20) sets the speech track's fade at every cut, and
  `edit.cutAudioCrossfade` makes it a cross-fade centred on the cut that keeps the track exactly the cut's length;
  `buildSpeechArgs` takes them as a fourth argument (`getSpeechCutOptions(edit)`). `transitions.jump: "auto"`
  compares the frames around each jump cut when the cut is built and gives it `zoom` below `transitions.autoThreshold`
  (default 0.08) and `fade` from it up; the new async `cutFootageFilm` (used by `renderFootageFilm` and the CLI) does
  this and returns and writes (`cuts.json`) what each cut measured, and `chooseCutTransitions`,
  `measureFrameDifference`, `chooseCutTransition`, `findAutoCuts` and `buildCutFrameArgs` are exported. The sync
  `cutFootage` is unchanged and leaves auto jump cuts as plain cuts. `FootageTransitions.jump` is now a
  `JumpTransition` (`CutTransition` or `"auto"`).

- **The footage render fits a small worker (#1030):** `renderFootage` renders the cut's picture in film time
  (`assets/picture.mp4`: one short ffmpeg per segment, one after the other, cross-fades drawn in, encoded with the
  `normalize` encoder's preset and threads) and composes one `<video>` over it; zoom cuts and Ken Burns stay tweens on
  that video. hyperframes then extracts the film's frames with one ffmpeg instead of one per segment at once, and its
  Chrome holds one video. On a 45 s 1080×1920 film of 12 segments at one CPU the extraction peak falls from 970 to
  222 MiB and the capture's from 1716 to 1209 MiB; the render takes one extra encode of the cut (about 75 s here).
  During a cross-fade the outgoing tail now follows the incoming segment's Ken Burns (a few tenths of a percent).
  `composeFootage` takes the picture as `assets.picture`; without it the composition is as before. New options
  `workers` and `lowMemory` pass hyperframes' `--workers` and `--low-memory-mode`. New exports: `planFootagePicture`,
  `buildPicturePieceArgs`, `buildPictureConcatArgs`, `buildPictureList`, `getPictureFrames`. README "Footage films in a worker" states the
  memory a render needs.

- **The finished film's loudness, and the ducking's timing (#1031):** a footage film's final pass now measures the
  whole mix after the render and normalizes it in two passes of `loudnorm` (one linear gain; the picture is still
  copied, only the sound re-encoded) to `FootageFilm.mixLoudness` (`marketing.json` `mixLoudness`), by default −14 LUFS
  integrated and −1 dBTP true peak, so a film comes out at the platforms' level instead of whatever the speech plus the
  music summed to (−25 LUFS measured on a 50 s film before). A silent mix is left as it is; `mixLoudness: null`
  (`false` in `marketing.json`) keeps the mix as rendered. The log names the measured and the target loudness.
  `FootageMusic` takes optional `attack` and `release` (seconds, `marketing.json` 0-5) for the ducking, absent keeping
  0.25 / 0.5 (`getDuckingOptions`). New exports: `measureLoudness`, `getLoudnessFilter`, `LoudnessMeasureOutcome`;
  `buildFinishArgs` takes `{ audioFilter }`. A fully silent track no longer fails the loudness measurement (ffmpeg
  prints its offset as `inf`). Upgrading: films get louder by default; set `mixLoudness: null` to keep the old output.

- **Captions anchored by their foot and fitted to a line limit (#1026):** a caption box can be anchored by its bottom
  edge (`bottom` in `CaptionLayout` and in the `layout` override, px from the frame's bottom; it wins over `top`), so a
  card of more lines grows upwards and its foot stays put; the screen-recording film, the footage film and the footage
  draft all follow it (`getCaptionPositionCss`). The 9:16 caption presets now anchor the box this way at the zone's
  bottom margin: a one-line card sits at the zone's edge instead of about a line above it, and a three-line card no
  longer reaches into the platform's interface. A footage film's `captionMaxLines` (1-4) shrinks a longer card's font
  in the render, to 70 % of the box's size at most (`CAPTION_MIN_FONT_SCALE`); the draft keeps its size. The caption
  metrics are exported: `CAPTION_LINE_HEIGHT` (1.18) and `CAPTION_PILL_PADDING` (`{ y: 16, x: 28 }`).

- **Thread count for the footage draft (#1024):** `renderFootageDraft` and `buildFootageDraftArgs` take
  `threads`, passed as `-threads N` to every segment's decoder and to the encoder, and as `-filter_complex_threads N`
  to the filter graph. By default ffmpeg still picks its own threads, which follow the host's cores, not a
  container's CPU quota; a 1-CPU worker passes `threads: 1`. A value that is not a positive whole number throws, as
  `normalize.threads` does. On 4 visible cores a 40 s draft of 20 segments peaks at 433 MB with `threads: 1` instead of
  1119 MB.

## 0.6.0

- **Music files without an extension, and video beds (#1020):** the footage film's music file source takes the stored
  file's original name and content type (`{ kind: "file", path, fileName?, contentType? }`), so a file stored under an
  extensionless key (`@softure-ai/files`' `getStorageKey`) passes the type check that 0.5.0 added. With neither and no
  extension on the path, the type check is skipped and `probeAudio` decides (an audio stream and a duration).
  `MUSIC_FILE_TYPES` accepts the video containers `.mp4`, `.m4v`, `.mov` and `.webm` again, as 0.4.0 did: their sound
  is the bed, and the music track reads only the audio. `checkMusicFileType` treats a name without an extension as no
  name, so a storage key with a content type is checked by the content type.
- **A fast ffmpeg draft of a footage film (#1018).** `renderFootageDraft(film, clips, transcript, edl, { buildDir,
  output, width?, layout?, log, signal?, onProgress? })` writes a small (540 wide by default) fast-start H.264/AAC
  draft with the film's phrase captions, zoom cuts, cross-fades, Ken Burns b-roll and speech track, without hyperframes.
  Pure builders `buildFootageDraftArgs`, `buildFootageDraftCaptions`, `planFootageDraft`, `getFootageDraftFrame`; the
  shipped caption font `FOOTAGE_DRAFT_FONT` (`fonts/`, DejaVu Sans Bold subset with every Polish letter).
  `checkFootageTools({ needsDraft: true })` reports a missing `ass`, `xfade` or `zoompan` filter (`DRAFT_FILTERS`).
  `getCaptionSpans` and `getFootageCaptionLayout` are shared by the render and the draft; progress gains the `draft`
  stage; `runFfmpeg` takes `cwd`.
- **Faster footage normalize and cut preview on a small worker (#1015).** `buildVideoFilter` now drops frames to
  30 fps and scales to the frame (crop: covered and cropped; blur: fitted, the blurred background made from the fitted
  picture) before the HDR tone map, so its float stages run on frame-sized pictures: a 4K HLG clip normalizes about
  2x faster with the crop fit and 3x with the blur fit on one core. `buildCutPreviewArgs` seeks each segment's input
  (`-ss`/`-t`) instead of trimming from the clip's start: the same frames, about 5x faster for 20 segments of one
  100 s clip. The normalized format changed slightly, so clips normalized by an earlier version are made once more.
  New `normalize: { preset, threads }` on the run options (`NormalizeEncoder`, `X264_PRESETS`) trades the
  intermediate's file size for speed.
- **Footage renders check the disk first (#1014).** hyperframes refuses to render with under 1 GiB free in its temp
  folder or the build folder, which ended a run with `hyperframes render ended with code 1`. Now `renderFootage`
  checks both folders before the music, speech and assets steps and returns `not enough disk space to render: …`,
  naming the folder; `checkFootageTools` reports the same with a render (`tempDir` and `buildDir` options).
  `renderFootage`'s new `tempDir` reaches hyperframes as `TMPDIR` (created when missing). `findLowDiskProblems`,
  `getFreeBytes`, `getRenderTempDir` and `RENDER_MIN_FREE_BYTES` are exported.
- Docs: the README and the worker recipe say `TMPDIR` needs a data volume, not a small tmpfs, and name
  `PRODUCER_MAX_WORKERS` and `HYPERFRAMES_EXTRACT_CACHE_MAX_MB` for a CPU-limited container.
- **Key terms for a footage film's transcript (#1012):** `FootageFilm.keyTerms` and `footage[].keyTerms` in
  `marketing.json` pass names and brand words to ElevenLabs Scribe (keyterm prompting, one `keyterms` form field per
  term), checked against Scribe v2's limits (`SCRIBE_KEYTERM_LIMITS`: 1000 terms, 50 characters, 5 words),
  trimmed, deduplicated and sorted (`normalizeKeyTerms`, `getFilmKeyTerms`). `SttInput.keyTerms` carries them to any
  STT provider, and the fake STT records them in `calls`. The transcript's cache key includes the key terms only when
  there are any: existing cached transcripts keep their keys. `FootageRates.keyTerms` (optional) is the surcharge per
  second that `estimateFootageFilm` adds to transcription for a film with key terms, and `FootageCharge.keyTerms`
  counts the terms a speech to text call sent. Invalid key terms fail `transcribeFootage` and `estimateFootageFilm`
  before anything is probed or paid for.

## 0.5.0

- **Music beds from an upload (#996):** `probeAudio(path, { signal })` reads a music file with ffprobe as `{ duration,
  codec, sampleRate, channels, bitRate }` (`bitRate` null when the container reports none); a failure is
  `{ ok: false, reason, error }` with `reason` `no-audio-stream`, `no-duration`, `unreadable` or `unexpected-output`.
  `readAudioProbe(json)` is the pure reader. `checkMusicFileType({ fileName, contentType })` checks an upload against
  `MUSIC_FILE_TYPES` (`.mp3`, `.m4a`, `.aac`, `.wav`, `.ogg`, `.oga`, `.opus`, `.flac` and their content types).
  `runFfprobe` is the shared ffprobe call. The README shows the upload check and how the bed is looped, trimmed and
  ducked under the cut.
- **Changed:** a footage film's `music.file` is now checked by the same rules in `prepareFootage`, right after the
  clips are probed: a file of another type (e.g. `.mp4`) or without an audio stream stops the run before anything is
  normalized or paid for. An app with such a bed converts it, e.g. `ffmpeg -i bed.mp4 -vn -c:a copy bed.m4a`.
- Docs: the README's `onCharge` points to `createFootageChargeRecorder` of `@softure-ai/metering`.

## 0.4.0

- **Natural editing for footage films (#898).** **Changed defaults:** cuts are hard cuts (`transitions: { jump:
  "cut", clip: "cut" }`), b-roll stays still, captions are plain phrases, and the end card plays no whoosh; set
  `transitions`, `edit.kenBurnsPercent`, `captionStyle: "highlight"` and `edit.endCardWhoosh` for the 0.3 look.
  - Sentences and retakes: `splitSentences` / `splitFilmSentences` (ids `s1`…), `findRetakes` (retake, false start,
    cut-off, with a reason; suggestions only), `buildEdl`'s and `renderFootageFilm`'s `keepSentences`,
    `getFootageSentences`. The CLI prints the suggestions after `--step=cut`.
  - EDL version 2: segment `id`, `audio: { clip, start, end, ownVolume }` (J/L-cuts, b-roll over speech; captions and
    ducking follow the sound), `validateEdl` (`findEdlProblems` stays as its alias), `diffEdl`, `getEdlJsonSchema()` and
    `schema/edl.schema.json`. Version 1 files are read and upgraded; the scored music's cache key ignores ids, so
    nothing is bought again.
  - `edit: { zoomPercent, fadeFrames, kenBurnsPercent, endCardWhoosh }` and `captionStyle` on the film;
    `phraseChunks`.
  - `extractFrames(file, { count } | { everySeconds }, { outDir, width })`: a contact sheet of a clip.
  - `captionPreset` and `CAPTION_SAFE_ZONES` (Reels, Shorts, TikTok, all); `findMissingCaptionGlyphs` runs on the
    caption and end-card fonts before the render and stops it on a missing letter.
- **Publishable footage films (#899).**
  - Loudness: the speech track is measured and normalized in two passes of `loudnorm` (default −14 LUFS, −1 dBTP)
    before the music goes under it; `loudness: { target, truePeak } | null` on `FootageFilm` (`false` in
    `marketing.json`). `normalizeLoudness` and its argument builders are exported.
  - A final pass over hyperframes' render: H.264 High, yuv420p, AAC 48 kHz stereo, `+faststart`, streams copied
    when they already match, checked with ffprobe (`findFinishProblems`, `readTopLevelBoxes`); progress stage `finish`.
  - A cover JPG next to the film, at `cover.at` or the middle of the first talking segment; `cover: null` (`false`
    in `marketing.json`) writes none.
  - `RenderedFootage` gains `bytes`, `width`, `height`, `durationSeconds` and `cover`, read from the written file;
    the CLI prints them.
- **Footage blocks for a server worker (#897).** **Breaking:** `probeFile`, `probeFootage` and `normalizeFootage` are
  async (they spawn without blocking the event loop), and `runFfmpeg` moved to `footage/process.ts`, async.
  - `FootageRunOptions` takes `signal` (an abort kills ffmpeg, ffprobe or hyperframes, removes the partial file and
    rejects with the signal's reason), `onProgress({ step, item, itemIndex, itemCount, done, total })` (seconds of
    media per stage, from ffmpeg's `-progress` and hyperframes' percentage) and `onCharge({ step, item, provider,
    units, credits?, cacheKey })` after each paid call; `renderFootageFilm` passes them through.
  - `estimateFootageFilm(film, { cacheDir, providers, rates })`: probes only, answers each paid step in seconds and
    in the caller's credits (`rates`), a cached step at 0. `findCachedStep(film, step, item, options)` checks the
    cache without network.
  - Providers take an optional `signal`; a transcript may carry `credits`, and isolation and music may return
    `{ audio, credits }` (a plain `Buffer` still works). ElevenLabs passes on its `character-cost` header.
  - `checkFootageTools()`: ffmpeg and ffprobe, the hevc decoder, the zscale and tonemap filters, hyperframes and its
    browser; the CLI runs it before `footage`. hyperframes' output now goes to `log`.
  - `docker/footage-worker.Dockerfile`: a worker image (Debian ffmpeg with libzimg, Chrome libraries, fonts,
    chrome-headless-shell), built and rendered in by CI; README "Footage films in a worker".

## 0.3.1

- The content of 0.3.0, which was never published: its release stopped at the gates (ESLint ran out of memory in
  `release.yml`) before publishing, and a tag is never moved.

## 0.3.0

- **Footage films (#886):** a second film kind, cut from filmed clips (a person talking to camera, b-roll) by their
  transcript. `footage[]` in `marketing.json` and `softure-marketing footage <film> [--step=transcribe|cut|render]
  [--commit] [--placeholder]`; see the README, "Footage films".
  - Clips (files or URLs) are probed (rotation, HDR, sound) and normalized: the film's frame at 30 fps, upright, HDR
    tone-mapped to SDR, `crop` or `blur` fill.
  - ElevenLabs Scribe transcribes with word times; Voice Isolator (optional), Music (prompt) and Video to Music
    (scored to the cut) are the other paid steps, each behind `--commit`, cached by content in `voice.cacheDir`.
  - The cut is an editable EDL (`edl.json`): fillers (per language) and long pauses cut, padding, maximum length;
    `cut`, `fade`, `zoom` and `whoosh` transitions, a slow zoom on b-roll; captions remapped through the cut; music
    ducked under speech.
  - Every step is a library export, and `renderFootageFilm(film, options)` builds a film without `marketing.json`.
- `videos` may be empty when `footage` has a film; ids are unique across both, and `social.posts` may name either.

## 0.2.0

- **Breaking (#446):** the `pl` dictionary is gone, with `MARKETING_LOCALES` and `MarketingLocale`. `brand.locale` takes
  any BCP 47 tag; the copy is English unless `brand.messages` (every key optional, `MarketingMessageOverrides`)
  translates it. `getMarketingMessages(overrides?)` applies such overrides; the loaded config carries
  `brand.messages` instead of `brand.language`.

## 0.1.12

- `shots` frames one row of a card that is shorter than its crop (#371):
  - `crop.fill: true`: a target shorter than its frame is stretched to the frame's bottom edge for the capture and
    its content centred vertically, so no page background or next card shows below it. Refused (gate `crop`) when
    the target still ends above the frame's bottom edge; excludes `crop.top`.
  - Step `flatten`: removes the top border and top margin of every match, e.g. the line above the first row a print
    state still shows; fails when nothing matches.

## 0.1.11

- `shots` entries take a print state (#333):
  - `hide`: CSS selectors hidden in that entry's files only, on top of `app.hideSelectors`. New gate `hide`: the file
    is refused when one of them still shows a rendered element inside the frame, or the browser cannot parse it.
  - `crop.top`: a second locator whose top edge starts the frame (e.g. a row inside a card); the width stays
    `crop.target`'s. Refused (gate `crop`) when it matches nothing or several, or lies outside the target.
  - Step `open`: opens every matching `<details>`; fails on a match that is not a `<details>` or did not stay open.
  - Step `hide` with `keepLast`: hides every match but the last N, e.g. the early columns of a sideways chart; fails
    when that would hide nothing.
- `SCREENSHOT_GATES` gains `hide` (between `crop` and `size`).

## 0.1.10

- Every command crashed on start-up when npm resolved satori to 0.35.2 or 0.36.0 (the case through `npx`, which has
  no lockfile): those releases end the process as soon as they are imported. satori is now pinned to `0.35.1`, and
  the CLI loads it only for `og`, so `shots`, `record`, `voice` and the other commands no longer load it at all
  (#254). An app that worked around it with `-p satori@0.35.1` can drop the extra package.
- `shots` signs in itself: a top-level `signIn` block (`path`, `steps`, `expect`, optional `prepare`) and
  `signedIn: true` on an entry. The sign-in runs once per run, its session stays in memory; a failed sign-in refuses
  every signed-in file (gate `sign-in`) and the others still run.
- `signIn.prepare`: the app's command that creates and seeds the account and prints a JSON object as its last line;
  `{data:key}` reads it in `expect`, `path` and step values, so the phrase gate checks a value of the seeded account.
  `{env:NAME}` reads the environment (a password). Nothing the kit resolves is printed.
- Entries take `steps` (`click`, `fill`, `check`, `press`) done before the gates read the page (gate `steps`).
- `crop: { target, aspect: "W:H", padding }` frames one element at a fixed aspect ratio, from the whole page (no
  sticky header over it), and checks the file's dimensions (gate `crop`).
- New gate `duplicate`: a file with the same bytes as an earlier file of the run is refused and deleted. The one
  change for a 0.1.9 config: a light and dark pair of a page that ignores the scheme keeps only its first file.
- `getLocator` moved to `src/record/locator.ts` (still exported from the actions module).

## 0.1.9

- `beats[].screenGuard`: a sentence's own phrases, checked while that sentence is on screen (at a `checkScreen` inside
  it, or when it ends), so each number is proven on screen when the voiceover says it. The video's `screenGuard` is
  still checked at every `checkScreen` and may be left out, with the `checkScreen`, when the sentences carry every
  phrase. A 0.1.8 `marketing.json` works as it is.
- README: `record <video> --placeholder` (0.1.8) is the rehearsal before paying; a script that recorded fake
  voiceovers into a second cache with a copy of `marketing.json` can go.
- `fill` replaces a value already in the input: the old value is selected and deleted on screen, then the new one is
  typed (over a prefilled `45`, `fill … "50"` records `50`, not `4550`). An empty input records as before; `"clear":
  false` keeps the old behaviour; an input the app refills makes the action fail with its name.
- New `press` action and `Director.press(key, { times, perKey })`: any key (`Backspace`, `Enter`, `ControlOrMeta+A`)
  one or more times. A hand-written `Director` needs the new method.

## 0.1.8

- Described in the GitHub Release `marketing-kit@0.1.8`.
