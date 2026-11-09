# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/marketing-kit`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`marketing-kit@x.y.z`).

## 0.23.0

- **No one-word caption cards on request:** a footage film's new `captionMinWords` (2: never a one-word card) evens
  out short cards: a card shorter than it joins the card before it when the join fits (at most one word over the
  target and the new `captionMaxCharacters`), otherwise words move over from the card before; a short first card does
  the same with the card after it. `captionMaxWords` sets the words a card aims at (a brand's words per caption;
  default 4 for `highlight`, 6 for `phrase`). The three are in `marketing.json` too. `captionChunks` and
  `phraseChunks` take `minWords` and `maxCharacters` (`phraseChunks` also `maxWords`), and `balanceCaptionGroups` is
  exported. Without them every card is cut as before.

## 0.22.0

- **Overlays on words in the EDL (#1200):** `edl.json` takes an optional `overlays[]` of `punch_in` (an emphasis zoom
  on a word), `keyword`, `lower_third`, `list`, `arrow` and `highlight`, each on a transcript word (`at_word`) or a
  film second (`at`), in the brand's colours and fonts. The render draws them from markup adapted from HyperFrames
  registry blocks and vendored into the kit (no network); the draft draws them in the same place at the same time.
  `resolveEdlOverlays` refuses, with a reason each, what cannot be drawn cleanly (a word never said, past the cut or
  across a cut, two at once, closer than the film's new `overlayMinSpacing`, on the captions or outside the platform
  safe zone, a punch-in on a Ken Burns segment or inside a zoom ease). An EDL without overlays renders as before.
- **hyperframes 0.9.20** (was 0.9.6). The kit's render arguments and the capture summary it reads are unchanged.

- **The lit caption word can sit on its own box (#1199):** a footage film's `captionHighlightStyle: "box"` sets the
  word being said on a rounded box of the new brand colour `captionHighlightBox`, its text in `captionHighlightText`,
  with the text highlight's timing, without moving the line; the render and the fast draft draw it alike. The default
  `"text"` is unchanged. The two colour roles are optional (`OPTIONAL_COLOR_ROLES`), in `brand.colors` and
  `brand.tokensFrom.roles`; a `box` film without them is an input error. `getCaptionHighlightContrast(colors)` returns
  the lit text on its box and the box on the pill for the app to warn on; `getContrastRatio` is exported too.
- **A weak cover accent can be boxed instead of refused (#1199):** `renderPhotoCover({ accent: true, accentStyle })`
  with `"box"` sets the `kicker-title` kicker on an opaque accent box, and `"auto"` boxes it only when the accent reads
  under 3:1 as text. The result reports `accent: { style, contrast }`. The text style's refusal now also suggests
  `accentStyle "box"`.

## 0.21.2

- **The isolator hears a float clip sound's ranges unclipped (#1193):** with `speechPeaks: "float"`,
  `isolateSpeechRanges` cuts each range for the isolation provider as 32-bit float PCM (`pcm_f32le`), like the clip
  sound itself, so a peak above full scale reaches the provider instead of being clamped by a 24-bit cut. The
  whole-clip path already sent the float file. The default (`ceiling`) keeps 24-bit ranges as before. A range keeps
  the sound's two channels, so its level is the same in both formats and cached ranges stay valid.
  `buildRangeAudioArgs` takes `{ peaks }` as a fourth argument.

## 0.21.1

- **A composition never names a remote file (#1191):** `composeFilm` and `composeFootage` throw when an asset is an
  `http(s)://` or protocol-relative address (`assertLocalReferences`), instead of letting hyperframes download it at
  render time. hyperframes' download helper is its only use of the `undici` it pins, so the `npm audit` finding on
  that `undici` stays unreachable. Every composition the kit builds itself is unchanged: its assets were already
  local. The README's "npm audit" section says why each audit finding does not apply.

## 0.21.0

- **The photo cover can carry the brand accent (#1188):** `renderPhotoCover({ accent: true })` sets the kicker of
  `kicker-title` in `colors.accent`, or the `pill` box in the accent (opaque) with the label in `foreground` or
  `background`, whichever reads better. Off by default: a cover without it is byte for byte the same. Another layout
  with the accent, or an accent under 3:1 against the scrim (kicker) or the label (pill), is an error
  (`MIN_COVER_ACCENT_CONTRAST`, from `/og`).

## 0.20.0

- **The mouth-click detector is exported for moving a cut past a click (#1182):** `findMouthClicks({ mono, sampleRate,
  offset, words })` returns the impulses outside the speech protection zone (`clicks`), each word's bound on the real
  sound (`words`: the wider of the transcript's bound and where the 10 ms energy falls 20 dB under the word's peak)
  and `isQuiet(stretch)` (no 10 ms window above −45 dBFS once the clicks' samples are left out). The rules are in
  `MOUTH_CLICK_RULES`: 1 to 25 ms, 2-10 kHz energy more than 12 dB over the ±50 ms median, not periodic, over within
  its length; protected are the word bounds ±80 ms and every stretch above −45 dBFS. No audio is changed.
- **A `repair` declick level with a minimum pause, the energy protection zone and limits (#1183):** `speech.declick:
  "repair"` repairs the same impulses only in pauses of at least 150 ms after the guard, outside the protection zone,
  at most 25 ms per repair (crossfades included), 3 a second and 1 % of the track (`DECLICK_REPAIR_RULES`); the
  impulses over a limit are left and counted in `DeclickReport.skippedLimit`, which the log line names. `gentle` and
  `strong` are unchanged (their reports carry `skippedLimit: 0`). New: `findRepairs`, type `DetectorDeclickLevel`;
  `findImpulses` and `DECLICK_SETTINGS` take `gentle` or `strong` only.

## 0.19.0

- **The speech pre-gain says what it reached, and can reach the target on peaky speech (#1181):** quiet phone speech
  with a few short peaks was held by the −3 dBTP ceiling around −26 to −28 LUFS instead of −23, silently.
  `ClipSound.preGain`, `IsolatedSpeech.speechPreGain` and `TranscribeOutcome.speechPreGain` answer `on_target`,
  `held_by_peak_ceiling` or `peaks_over_ceiling` with `inputLufs`, `inputTruePeakDbtp`, `reachedLufs` and
  `truePeakDbtp` (or `silent`, or `shared` for a non-talking clip), and the `log` names every held clip. The opt-in
  `speechPeaks: "float"` (`FootageRunOptions`, `IsolateSpeechRangesOptions`, `prepareClipSounds({ peaks })`) raises
  the clip to the target by the same single linear gain and writes its sound as 32-bit float WAV, so the peaks cannot
  clip; no limiter or gate touches the speech. New: `getSpeechPreGain`, `describeSpeechPreGain`, types
  `SpeechPreGain`, `MeasuredPreGain`, `SpeechPeaks`. Additive: `gainDb` and `speechGainDb` stay.

## 0.18.0

- **The speech declick repairs impulses and no longer gates speech (#1170):** `speech.declick` `gentle` and `strong`
  lowered the pauses between transcript words by 15 or 20 dB; the transcript's boundaries are 20 to 60 ms off the real
  sound, so the gate lowered decays and onsets and was heard as hoarseness and pumping. Now the stage changes no gain:
  nothing within ±80 ms of a word is touched, and each single impulse in a longer pause (a burst under 12 ms) is
  replaced by least-squares AR interpolation with a 3 ms crossfade on each side; every other sample is unchanged. The
  default stays `off`. Breaking for apps that import the stage's internals:
  - `DeclickReport` is `{ level, impulses, repairs }` (`repairs`: each repaired impulse's `start` and `end` in
    seconds); `gateDb` is gone, and the log line lists the repair times;
  - `getGateWindows`, `getDeclickGain`, `DECLICK_GATE_FADE`, `DECLICK_IMPULSE_DB`, `DECLICK_WORD_WINDOW` and
    `DeclickSettings.gateDb` / `crossfadeSeconds` are removed; new are `getRepairZones`, `repairSpan`,
    `getArPolynomial`, `DECLICK_WORD_GUARD`, `DECLICK_CROSSFADE`, `DECLICK_AR_ORDER` and `DECLICK_AR_CONTEXT`;
  - `DECLICK_MAX_IMPULSE` is 12 ms (was 30 ms).

- **Where the cover's text and focus landed (#1172):** `PhotoCover` answers `textBox` (the drawn text with its shadow,
  the box the fit check measured, `{ left, top, right, bottom }` in pixels with right and bottom excluded; null for
  layout `photo`) and `focusPoint` (`{ x, y }`, the focus point on the cover after the crop). The new
  `isPointUnderCoverText(cover, point, marginPx = 0)` tells whether a point lies under the text, so an app can warn when
  the caption covers the photo's subject without re-deriving the kit's layout rules. Types `CoverBox` and `CoverPoint`.
- **Read an uploaded font file (#1174):** `readFontFileInfo(data)` answers a `.ttf`, `.otf`, `.woff` or `.woff2`
  file's family, format, weight (static, or a variable `wght` range), the CSS weight a `brand.fonts` file takes,
  style, and whether captions, the footage draft and OG images (the photo cover included) can use it, with a reason
  code when not. A `.woff2` file says it is not usable for the cover (Satori does not read it), so an app refuses it
  at upload. `findMissingCharacters(data, characters)` runs the glyph check on a file directly. Both are exported
  from `.` and `./og` and return error values, never exceptions.
- `readCharacterMap` reads WOFF2 files too (their tables are Brotli-decompressed), and a file it cannot read says
  "not a TrueType, OpenType, WOFF or WOFF2 font".

- **A footage end card of any length and a short logo card (#1173):** a footage film's `endCard` takes `seconds`
  (1-3, default 3, so today's films are unchanged); `getFootageFilmSeconds`, the paid-step estimate and the dry run
  follow it, and a shorter full card plays its entrances faster. `endCard.layout: "logo"` draws a short brand card:
  the brand's background fading in over `fadeSeconds` (default 0.2), the logo (the card's own `logo`, `.svg` or `.png`
  with alpha; else `brand.logo`; else the brand name) and an optional `line`, inside the 9:16 platform safe zone, for
  `seconds` (default 1.5), with the music fading out over the whole card to the film's end (`buildMusicArgs` takes
  `fadeOutSeconds`). The glyph check covers the line. New exports: `FootageEndCard`, `FullFootageEndCard`,
  `LogoFootageEndCard`, `getEndCardSeconds`, `getEndCardTexts`, `getLogoCardBox`, `DEFAULT_END_CARD_SECONDS`,
  `DEFAULT_LOGO_END_CARD_SECONDS`, `DEFAULT_LOGO_END_CARD_FADE_SECONDS`. The footage pipeline now copies the logo with
  its own extension (`assets/logo.png` for a PNG).

## 0.17.0

- **Cached speech ranges land at the pre-gained level (#1159):** since the speech pre-gain (#1139) `isolateSpeechRanges`
  lays every cleaned window over the clip's pre-gained sound, but a range cached from the un-gained sound kept its old
  level, so the voice dropped by the clip's pre-gain (about 17 dB on a quiet phone clip) inside that window. Now:
  - a bought range records the gain of the sound it was cut from next to its cached file
    (`<path>.gain.json`, `{ "inputGainDb": <dB> }`; `getSpeechRangeGainPath`, `formatSpeechRangeGain`,
    `readSpeechRangeGain`). Commit it with the cached file;
  - each laid window is raised by the clip's pre-gain minus that gain. A cached range without a record is told apart by
    its loudness against the same range of the clip's pre-gained sound (`getRangeInputGainDb`, `buildRangeMeasureArgs`),
    so ranges bought before 0.16.0 and with 0.16.0 both land right. Cache keys are unchanged: nothing is bought again;
  - each range answers the `gainDb` it was raised by (`LaidRange.gainDb` in `buildRangeLayArgs`), and
    `IsolatedSpeech.speechGainDb` and `TranscribeOutcome.speechGainDb` (optional in the type, always answered) give each
    clip's pre-gain in dB, so an app that lays its own cached ranges over the speech map can apply the same correction.

- **Photo cover layouts (#1163):** `renderPhotoCover` takes `layout` (`PHOTO_COVER_LAYOUTS`: `photo`,
  `title-bottom`, `title-center`, `title-top`, `kicker-title`, `pill`), `kicker` (at most 40 characters, drawn by
  `kicker-title` above the caption) and `tone` (`light`: light text over a dark scrim, the default; `dark`: dark text
  over a light scrim). Each layout keeps its text to its part of the centre 4:5 band (the lower half, the middle third
  or the upper half), measured on the drawn pixels, and refuses text that does not fit. The scrim follows the text
  (from the bottom, from the top, a stripe behind a centred title); the `pill` label (at most 32 characters) sits in a
  rounded box of the dark colour instead. An overlong kicker or pill label, a character the fonts cannot draw in either,
  a layout without the text it needs and a text its layout does not draw are errors. Without `layout` a call draws what
  it drew in 0.16.0.

## 0.16.0

- **Provider failures carry structured details (#1141):** a failed answer of a footage provider (`TtsResult` with
  `ok: false`) carries `providerFailure` next to `error`: `{ kind, status, code, message, requestId, isRetryable }`,
  `kind` one of `refused` | `rate_limited` | `unavailable` | `timeout` | `connection`. The ElevenLabs speech to text,
  voice isolation and music providers set it on every failed request (the HTTP status, the provider's code and
  message from the body's `detail`, truncated, the `request-id` header; a missing key is `refused` with code
  `missing_api_key`). `isRetryable` is true for 5xx, 408, 429, a timeout and a failed connection. Every field is safe
  to log; `describeProviderFailure` gives one line. `error` keeps its sentences; `providerFailure` is optional, so a
  custom provider still compiles.
  - `isolateSpeechRanges` asks a range again only when its failure is retryable (a 400 `audio_too_short` is asked
    once), and a `failed` outcome carries `providerFailure` (null when the provider gave none).
  - `FootageFailure` gets `{ kind: "provider", provider }` for a failed speech to text, voice isolation or music call;
    `isRetryableFootageFailure` follows `provider.isRetryable`. A provider that gives no details still answers
    `process`. An exhaustive `switch` on `failure.kind` needs the new case.
- **A lossless, pre-gained speech chain (#1139):** quiet phone speech is no longer encoded lossily before its gain.
  `transcribeFootage` (and `--placeholder`) extracts each clip's sound from its source with the normalize step's own
  seek and length into `audio/<clip>.wav` (24-bit, 48 kHz stereo), pre-gained right away to about -23 LUFS with its
  true peak at or under -3 dBTP (`prepareClipSounds`, `SPEECH_PRE_GAIN`; a non-talking clip takes the talking clips'
  mean gain, so a b-roll's own sound keeps its relation to the speech). The Voice Isolator and speech to text get that
  WAV, on the whole-clip path and in `isolateSpeechRanges` (ranges cut to WAV, laid to `audio/<clip>.ranges.wav`); the
  cached cleaned voice is decoded to `audio/<clip>.isolated.wav`. The speech chain writes float WAV throughout
  (`speech.raw.wav`, `speech.declicked.wav`, `speech.wav`; `getSpeechChainFiles`, the composition plays
  `assets/speech.wav`), so the film's final AAC is the only lossy encode. `buildSpeechArgs`, `buildLoudnessArgs`,
  `buildRangeLayArgs`, `buildRangeAudioArgs`, `buildAudioArgs` and the declick encode pick the codec by the output's
  extension (`getAudioCodecArgs`: `.wav` lossless, `.flac`, else MP3), so an app's own `.mp3` names still work. The
  speech map now points at those WAVs instead of the normalized clips. Cache keys are unchanged: nothing is bought
  again, and a cleaned voice bought earlier (from the un-gained sound) is reused as it is.
- **`mixLoudness.audioBitrateKbps`** (192 to 512, default 192): the finished sound's AAC bitrate; `buildMixArgs` takes
  `bitrateKbps`.
- **The footage draft plays at the render's loudness (#1143):** `renderFootageDraft` runs the render's sound chain:
  the speech track's loudness pass (`loudness`) after its cut and declick, then the render's mix stage over speech and
  music (`mixLoudness`, its `attempts`, `warnTolerance` and true peak ceiling), whose AAC is copied into the draft. A
  draft of quiet speech (about -40 LUFS at the source) no longer plays near -32 LUFS against the render's -14.
  `FootageDraft` gains `loudness` (as measured, `warning` on a near miss) and `mix` (what the stage did); a mix that
  misses its target fails the draft with `{ kind: "loudness" }`, as it fails the render. `onProgress` reports the
  items `loudness` and `mix`. `buildFootageDraftArgs` takes `mix` (an encoded mix to copy). The draft's speech files
  take the render's names (`getSpeechChainFiles`).
- **Speech ranges reach the Voice Isolator's minimum input (#1140):** a range shorter than the provider accepts is no
  longer sent, refused three times and left uncleaned.
  - `IsolationProvider.minSeconds`: the shortest input the provider accepts; the ElevenLabs provider declares 4.6 s
    (`ELEVENLABS_ISOLATION_MIN_SECONDS`).
  - `planSpeechRanges` plans source ranges: ranges of a clip at most `mergeGap` seconds apart (default 2) are merged
    into one; with `minSeconds`, a range still shorter is widened symmetrically with the clip's own context to the
    minimum plus `minPad` (default 0.4 s), and `range.heard` keeps the part the cut hears, which is all that is laid.
    A range that cannot reach the minimum is marked `skip` and never sent (`outcome: { kind: "skipped" }`).
  - `isolateSpeechRanges`, `estimateSpeechRanges` and `estimateFootageFilm` (`isolate: "segments"`) plan with the
    provider's minimum and take `mergeGap` and `minPad`; the estimate prices exactly the ranges sent and marks a
    skipped one (`skipped`, at 0).
  - A range refused on every attempt leaves no cut file under `<buildDir>/audio/ranges/`.
  - `createFakeIsolationProvider({ minSeconds })` refuses a shorter input with `audio_too_short`.
  - **Cache keys:** merged and widened ranges are new ranges, so ranges an app has already paid for per segment are
    not found again. Pass `mergeGap: null` to keep the per-segment ranges (short ones are still widened when the
    provider declares a minimum).
- **`renderFootage` reports how hyperframes captured the frames (#1145):** the rendered value carries `capture`
  (`{ path, gpu, seconds, isEncodeStreamed, fallbackHint }`, null when hyperframes printed no summary), read from
  hyperframes' summary line, so an app can log or alert on a render that took the slower screenshot path.
  `readHyperframesCapture(lines)` parses hyperframes' output on its own. The README's "Footage films in a worker"
  says that `lowMemory: true` pins screenshot capture (about 30 % slower on one CPU). Code that builds a
  `RenderedFootage` itself now needs `capture`.
- **A video cover from a photo (#1137):** `renderPhotoCover({ photo, size, focus, caption, colors, fonts, quality })`
  draws a vertical video cover (1080×1920 by default) from a JPEG or PNG (path or bytes): scaled to cover and cropped
  around `focus`, EXIF orientation applied, with an optional caption in the brand's heading font over a soft scrim,
  kept in the lower half of the centre 4:5 band (`getCoverBand`). An overlong caption and a missing glyph are errors.
  Returns `{ jpeg, width, height, bytes }`. New dependency: `jpeg-js` (pure JavaScript JPEG encoder).

## 0.15.0

- **The footage film's mix is bounded:** `buildFilmMixArgs` pads to the film's length (`apad=whole_dur`), trims and
  caps the output (`-t`), and throws on a length that is not a positive number. A CI run once wrote an unbounded
  90 GB mix until the disk was full.
- **Footage failures name their kind (#1126):** a failed `FootageResult` (`renderFootage`, `finishFootage`,
  `renderFootageFilm`, `prepareFootage`, `renderFootageDraft`, …) carries `failure` next to `error`, so an app can
  tell a gate miss from a failure worth retrying without reading the sentence:
  - `{ kind: "loudness", loudness }`: the film's mix or the finished film misses `mixLoudness`; `loudness` is the
    last measurement (`{ integrated, truePeak }`), null when the mix measures silent after its gain and limiter;
  - `{ kind: "publishable", problems }`: the finished file fails the container, profile or fast start checks;
  - `{ kind: "input" }`: the film, its EDL, fonts, files or settings cannot be used as given;
  - `{ kind: "process" }`: anything else (a process that exited, the network, the disk).
  `isRetryableFootageFailure(failure)` is true for `process` only. `error` keeps its sentences. A failed ffmpeg step
  still throws and an abort still rejects with the signal's reason. Code that builds a footage failure itself now
  needs `failure`.
- **`isolateSpeechRanges` keeps going past a refused range (#1127):** one refused range no longer throws away every
  range already bought in the call.
  - A refused range is asked again: `retry: { attempts, delaysMs, wait }` (default 3 attempts after 1 s and 2 s), the
    wait stopped by `signal`.
  - A range refused on every attempt keeps the clip's own sound in its window; the others are laid and the call
    answers `ok`. Only a cancel throws. `IsolatedSpeechRange.outcome`: `cached` | `bought` (`attempts`) | `failed`
    (`error`, `attempts`) | `not_bought`.
  - Every join between the clip's sound and a cleaned window is a linear crossfade (`fadeMs`, default 15;
    `getSpeechRangeFades`): on a constant-level clip under a half-level window no sample steps by more than 0.01.
    `buildRangeLayArgs` takes `{ fadeMs }`.
  - `chargeItem(range)` names a range's charge item (default the clip id); `rangeCache(range, clipKey)` points the
    block and `estimateSpeechRanges` / `estimateFootageFilm` at an app's own cached ranges.

## 0.14.0

- **The footage mix converges at a fixed ceiling, before the frames (#1124):** on high-crest, transient-rich speech
  (quiet phone speech raised by the speech chain, clicks and plosives) the mix stage moved the gain and the limiter's
  ceiling together, the limiter took back what the gain added, and the film failed after every frame was rendered.
  Now:
  - the ceiling starts 1 dB under `truePeak` and moves only by an encode's measured true peak excess (the codec's
    overshoot), never with the loudness;
  - the gain is solved at that ceiling on uncompressed passes of the chain (one decode of the sound, no encode;
    secant steps, a step by the miss where the limiter makes the loudness fall with the gain, at most 6 passes), so
    the encode lands where the pass measured, and a retry shifts the aim by the codec's measured drift;
  - the chain ends in a 16 kHz low-pass and the AAC encoder cuts at 16 kHz: the limiter's fast gain moves left high
    frequencies on every click that AAC turned into up to 3.4 dB of overshoot, now within about 1 dB;
  - **the film's sound is mixed by ffmpeg** (speech, music, the whoosh and pop cues, as the composition plays them),
    brought to the target, encoded and gated **before hyperframes renders a frame**, so a mix that misses fails in
    seconds; the final pass muxes it under the picture (hyperframes' own sound is no longer used for the finished
    mix; `mixLoudness: false` still keeps it).
  On the issue's fixtures master took 2 and 4 encodes or failed after 4; every fixture now finishes in at most 2
  (most in 1).
- `mixLoudness.attempts` (1 to 6, default 4): how many encodes the stage may take.
- `mixLoudness.warnTolerance` (at least `tolerance`): a finished mix outside `target ± tolerance` but inside
  `target ± warnTolerance`, under the true peak limit, finishes with `loudness.warning` (a sentence naming both values,
  also logged) instead of failing. The true peak limit has no band.
- `FinishedFootage.loudness` carries `warning` (null when the mix is inside its tolerance); `mix` carries `encodes`.
- With `keep: "speech"`, a mix inside the window shrunk by 0.1 LU (through the limiter) gets no gain; a miss is aimed
  0.45 LU inside the edge (`MIX_AIM_EDGE_MARGIN`).
- **Changed exports:** `getFirstMixAttempt`, `getNextMixAttempt`, `getLimiterSlope`, `MIX_LIMITER_SLOPE`,
  `MIX_LIMITER_SLOPE_MAX` and `MIX_RETRY_EDGE_MARGIN` are gone; `getFirstMixCeiling`, `getNextMixCeiling`,
  `getMixAim`, `getNextGainProbe`, `getBestGainProbe`, `solveMixGain`, `getLoudnessVerdict`, `getMixAttempts`,
  `MIX_LOWPASS_HZ`, `MIX_GAIN_PRECISION`, `MIX_GAIN_PROBES`, `MIX_AIM_EDGE_MARGIN`, `getFootageSfxCues` and
  `buildFilmMixArgs` are new. `getMixFilter` ends in the low-pass, `buildMixArgs` adds `-cutoff 16000`,
  `buildLoudnessMeasureArgs` and `measureLoudness` take an optional filter, and `buildFinishArgs` maps a given
  `audioFile` even when the render has no sound.
- Docs: the README's Install section also covers the `undici` 7.25.0 that hyperframes pins (high in `npm audit`) and
  gives one `overrides` entry for it and `fflate`.

## 0.13.2

- satori 0.63.2 (was 0.35.1, still pinned exactly, #254). satori 0.36 and later size boxes like CSS's default
  `content-box`, so a `width` or `100%` no longer included the padding and the OG templates ran past the frame; every
  element now carries `boxSizing: "border-box"`, and the four snapshots render the same layout (only anti-aliasing
  differs).
- Docs: the README's Install section explains the `fflate` 0.7.3 audit finding that comes with satori and the
  `overrides` entry that lifts it.

## 0.13.1

- hyperframes 0.9.6 (was 0.9.5): `HYPERFRAMES_VERSION` follows; the fixture and footage film renders pass unchanged.

## 0.13.0

- **The mix stage's retries pay back what the limiter takes (#1095):** with `mixLoudness.keep: "speech"` and loud,
  percussive music, a retry aimed at the window's edge while the same retry lowered the limiter's ceiling, the limiter
  took part of the gain back, and the mix fell past the edge again until the film failed after 4 encodes (about one
  such mix in four). A retry now models the limiter: the loudness it takes grows with how hard it is driven (gain
  minus ceiling), at a slope fitted from the encodes so far (0.5 LU per dB until two encodes spread, at most 0.7), and
  the gain is solved for the loudness the mix will have at the new ceiling. With `keep: "speech"` the gain stays while
  that loudness is 0.3 LU inside the window and otherwise aims 0.3 LU inside the edge it would miss. The first encode is
  unchanged, so a mix that meets the target at once gets the same gain. **Changed export:**
  `getNextMixAttempt(tries, inputI, target)` now takes every encode so far (`MixTry[]`, oldest first) and the render's
  measured loudness instead of one attempt and its measurement. New exports: `getLimiterSlope`, `MIX_LIMITER_SLOPE`,
  `MIX_LIMITER_SLOPE_MAX`, `MIX_RETRY_EDGE_MARGIN` and the `MixTry` type.

## 0.12.0

- **A declick stage in the footage speech chain (#1084):** a footage film's `speech: { declick: "off" | "gentle" |
  "strong" }` (`marketing.json` `speech.declick`, default `off`) cleans mouth clicks and lip smacks between words in
  `renderFootage` and `renderFootageDraft`, between the cut speech track and its loudness pass. A gate lowers the speech
  outside each word's window (± 40 ms, 20 ms fade outside it) by 15 or 20 dB, and impulses under 30 ms outside the
  words (a jump in the 2-8 kHz band above its running median, 15 or 9 dB) are lowered by 30 dB with a 5 or 8 ms
  crossfade. The rendered result and the draft carry `declick: { level, impulses, gateDb } | null`, and the stage logs
  the count. `off` (also an absent setting) runs no extra pass, so existing films sound the same. Exported:
  `declickSpeech`, `declickSamples`, `findImpulses`, `getDeclickGain`, `getGateWindows`, `getRunningMedian`,
  `buildDeclickDecodeArgs`, `buildDeclickEncodeArgs`, `describeDeclick`, `getDeclickLevel`, `getSpeechChainFiles`,
  the `DECLICK_*` constants and the `DeclickLevel`, `DeclickReport`, `FootageSpeech` types.
- **Voice isolation per time range (#1087):** `isolateSpeechRanges(film, clips, edl, { buildDir, cacheDir, providers,
  isCommit, margin?, log?, onCharge?, onProgress?, signal?, onFfmpegFailure? })` cleans only the ranges the cut hears
  (each sound span ± `margin`, default 0.25 s, clamped to the clip), caches each by the clip's identity, the range in
  milliseconds and the provider, and lays the cleaned windows over the clip's own sound into one file per clip (mute
  inside each window, `adelay` the cleaned range, `amix normalize=0`; overlapping ranges switch at the middle of the
  overlap; a mono answer goes to both channels at full level). It answers the speech map `renderFootage` takes, and
  without `isCommit` lays only cached ranges. `estimateSpeechRanges` and `estimateFootageFilm`'s `isolate: "segments"`
  price the uncached ranges. `FootageCharge.range` and `FootageEstimateItem.range` name a range. New exports:
  `planSpeechRanges`, `getSpeechRangeWindows`, `getSpeechRangeCache`, `buildRangeAudioArgs`, `buildRangeLayArgs`,
  `DEFAULT_SPEECH_RANGE_MARGIN` and their types. Whole-clip `isolateVoice` works as before.
- **The finished mix can keep the speech's level (#1085):** `mixLoudness.keep: "speech"` (`marketing.json` and
  `FootageFilm.mixLoudness`, with `tolerance` in LU, default 1) applies **no gain** while the render's mix measures
  inside `target ± tolerance`, and otherwise only the smallest gain to that window (aimed 0.2 LU inside its edge). The
  speech, already at `loudness`, then keeps one level whatever the music volume, and a music volume step is heard as
  set; before, the gain to the target followed the music and moved the speech by 0.1-0.6 dB between two music volumes.
  The #1079 true peak limiter, encode, retries and gate run as before; the gate checks `target ± tolerance` (in both
  modes; without `tolerance` it stays 1 LU). New `mix: { measured, gainDb, ceilingDbtp, keep } | null` on
  `FinishedFootage` (so on `renderFootage`'s rendered result): the render's mix as measured and what the last stage
  applied; the log line names the window (`gain 0.0 dB (speech kept: -14.0 ± 1 LUFS)`). Also exported: `getMixGain`,
  `getMixTolerance`, `MixLoudnessTarget`, `FinishedMix`. Without the option nothing changes.
- **An EDL segment can move the caption box for its own captions (#1077):** `EdlSegment.caption: { bottom?, top? }`
  (px of the film's frame, as `CaptionLayout`) is merged over the film's caption box for the captions that start in
  that segment; `bottom` anchors by the foot and wins, `top` alone hangs the box from that top. A chunk that spans a
  cut keeps the box of the segment its first word starts in. The render (an inline position on the chunk) and the
  draft (an ASS style per moved box) draw the same box. `edlSchema`, the JSON Schema and `readEdl` take the field;
  `validateEdl` takes optional `captionBounds` and `readEdlFile` passes them, refusing an edge past the frame less one
  card; `diffEdl` names the move (`s4 captions moved`). New exports: `EdlCaption`, `EdlCaptionBounds`,
  `findSegmentAt`, `applySegmentCaption`, `getSegmentCaptionLayout`, `getCaptionChunkLayouts`, `getCaptionBounds`,
  `isSameCaptionPlace`; `readEdlFile` takes the project's `layout`. An EDL without the field renders as before.
- **The finished footage film holds its true peak (#1079):** `finishFootage` (and so `renderFootage` and
  `renderFootageFilm`) no longer trusts `loudnorm` before the AAC encode, which added 0.7-1.1 dB of inter-sample
  overshoot (a film with loud music measured up to +0.9 dBTP against a -1 dBTP limit). The mix's last stage is now one
  linear gain and a true peak limiter at 4x the film's rate (`alimiter`, delay compensated), encoded to AAC on its own
  and measured; while the encoded true peak is over `mixLoudness.truePeak` (or the integrated loudness is outside
  `mixLoudness.target` ± 1 LU) the ceiling is lowered by the overshoot plus 0.3 dB, the gain corrected, and the sound
  encoded again, at most 4 times (the first ceiling sits 1 dB under the limit). The final pass muxes it with
  `-c:a copy`, the picture untouched. The finished MP4 is then measured, and a film that still misses the target fails
  with `err(...)` naming both values instead of a version. New `loudness: { integrated, truePeak } | null` on
  `FinishedFootage` (so on `renderFootage`'s rendered result): the finished file's measurement, null without sound or
  for a silent mix; with `mixLoudness: false` it is reported, not held to a target. The log states the measured values
  instead of the targets. Also exported: `getMixFilter`, `buildMixArgs`, `getFirstMixAttempt`, `getNextMixAttempt`,
  `findLoudnessProblems`, `formatDb`, `MIX_ATTEMPTS`, `MIX_ENCODE_HEADROOM`, `MIX_LOUDNESS_TOLERANCE`, `MixAttempt`,
  `MixLoudness`; `buildFinishArgs` takes `audioFile`. Nothing to change for an app; an app that tests the old log line
  ("normalized to -14 LUFS") reads the new one.
- **The footage draft keeps no-break spaces in its captions (#1080):** a caption word joined with U+00A0 (a number and
  its unit, a short word and the next) reaches the draft's ASS as the hard space `\h`, so libass never wraps a line
  there, as the render's caption does not. Other white space still collapses to one space.
- **A caption card never ends on a word that keeps with the next (#1081):** a footage film's cards, `phrase` and
  `highlight` alike, in the render and the draft, no longer end on a one-letter word, a short preposition or a number
  torn from its unit. The cards are cut in film time (`remapWords`), so the rule also holds where a cut falls between
  the two words. A full card hands its kept tail to the next card (cards keep their word limit); a pause after a kept
  word does not end a phrase; punctuation still ends a card. The words come from the film's `captionKeepWithNext`
  (compared lower-case; `[]` keeps numbers only), else the language's `DEFAULT_CAPTION_KEEP_WITH_NEXT` (`pl`: `a i o u
  w z we ze na do od po za ku`, `en`: `a an the`); a number always keeps with the next word. `captionChunks(words,
  { maxWords, keepsWithNext })` and `phraseChunks(words, { keepsWithNext })` take the predicate (a number still means
  `maxWords`); screen films are unchanged. New exports: `CaptionChunkOptions`, `PhraseChunkOptions`,
  `CaptionWordsFilm`, `DEFAULT_CAPTION_KEEP_WITH_NEXT`, `getCaptionKeepsWithNext`, `getFootageCaptionChunks`,
  `splitAfterKept`. A Polish film's cards change where they ended on one of the default words.

## 0.11.0

- **The final pass can publish H.264 High from a draft render (#1068):** `finishVideo: { preset, crf, maxBitrate? }`
  on `renderFootage` and `renderFootageFilm` re-encodes the picture in the final pass instead of copying it: H.264
  High, yuv420p, at that x264 preset and CRF, capped at `maxBitrate` (`-maxrate`, with a `-bufsize` of twice the cap)
  when set. `quality: "draft", crf: 18` plus `finishVideo: { preset: "veryfast", crf: 20 }` gives High at a
  controlled size for about a quarter of the `standard` tier's encode. The loudness pass, fast start and cover stay
  as they are; the stage's progress follows the re-encode. Invalid values end the run with a sentence before anything
  is bought or built. New exports: `FinishVideo`, `findFinishVideoProblems`; `buildFinishArgs` takes `video`. Without
  the option nothing changes.

## 0.10.0

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
