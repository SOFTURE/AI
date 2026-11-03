# Research: marketing-kit-audio-probe-996

## Confirmation (master 4a1370a)

- `src/footage/probe.ts`: `readFootageProbe` returns `{ ok: false, error: "no video stream" }` when no stream has
  `codec_type: "video"` with a size, so an mp3 or wav cannot be probed. The ffprobe call and its JSON parsing live only
  inside `probeFile`.
- `src/footage/pipeline.ts` `getMusic`: a `music.file` source is accepted when `existsSync(path)`; an unreadable or
  silent file reaches ffmpeg in `buildMusicArgs` and fails late, after paid steps (transcript, isolation) ran.
- `src/config/config.ts` `findMissingFootageFiles` checks only that the music file exists.
- `buildMusicArgs` (`src/footage/render.ts`) already loops the input (`-stream_loop -1`) and cuts it at the film's
  length (`-t`), resamples to 48 kHz stereo, applies the ducking envelope (`duckingKeyframes`) and fades in 1 s, out
  1.5 s. So a probed bed of any length fits: shorter loops, longer is trimmed.

The issue's report is confirmed.

## ffprobe facts for audio

`-show_streams -show_format -of json` gives, per audio stream: `codec_name`, `sample_rate` (string), `channels`
(number), `bit_rate` (string, absent for some containers such as Opus in Ogg or flac), `duration` (string); the format
carries `duration` and `bit_rate`. An mp3 with cover art also has a `video` stream (`mjpeg`, attached picture), so an
audio probe must look for the audio stream and ignore video.

## Options

1. A separate `probeAudio` / `readAudioProbe` beside the footage probe, sharing one ffprobe runner extracted from
   `probeFile`. Typed failure: a discriminated `reason`.
2. `probeFootage` with `kind: "audio"`: rejected; `probeFootage` takes clips with trims and returns `ProbedClip`, a
   different shape for a different job.

Chosen: option 1.

## Accepted music types

Extensions ffmpeg (the footage image's build) decodes and browsers report: `.mp3` (`audio/mpeg`, `audio/mp3`), `.m4a`
(`audio/mp4`, `audio/x-m4a`, `audio/m4a`), `.aac` (`audio/aac`), `.wav` (`audio/wav`, `audio/x-wav`, `audio/wave`,
`audio/vnd.wave`), `.ogg`/`.oga` (`audio/ogg`), `.opus` (`audio/opus`, `audio/ogg`), `.flac` (`audio/flac`,
`audio/x-flac`). Content types compared without parameters and case-insensitively.
