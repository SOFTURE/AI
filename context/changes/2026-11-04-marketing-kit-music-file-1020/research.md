# Research: marketing-kit-music-file-1020

## What the code does

- `src/footage/film.ts`: `MusicSource` file branch is `{ kind: "file"; path: string }`; nothing else about the file.
- `src/footage/pipeline.ts` `checkMusicFile(path)`: existence, then `checkMusicFileType({ fileName: path })`, then
  `probeAudio`. Called from `prepareFootage` before any clip is normalized.
- `src/footage/audio.ts` `checkMusicFileType`: `extname(fileName)` is `""` for an extensionless name, which is not
  `null`, so it is looked up in `MUSIC_FILE_TYPES` and refused, even when a valid `contentType` is also given.
- `src/footage/render.ts` `buildMusicArgs`: `-stream_loop -1 -i <bed> -t <s> -af … -c:a libmp3lame <out>.mp3`. No
  `-vn`: ffmpeg maps the input's video stream too, and the mp3 muxer takes a video stream only as a single-packet
  attached picture (its default video codec is PNG), so a bed with real video (an `.mp4` clip) fails there; an mp3
  with cover art carries the picture over. `-vn` makes the track audio only in both cases.
- `src/config/config.ts` `resolveMusicSource`: `music.file` in `marketing.json` → `{ kind: "file", path }`.

## Measurement

`ffmpeg -stream_loop -1 -i clip.mp4 -t 2 -af … -c:a libmp3lame out.mp3` on an h264 + aac clip fails without `-vn`
(the encoder tries the video stream) and succeeds with it. An extensionless copy of an `.m4a` or `.mp4` probes the
same with ffprobe (the container is sniffed, not named).

## Options

1. Optional `fileName` / `contentType` on the file source; skip the type check when the source says nothing and the
   path has no extension; accept video containers as beds and add `-vn`. Small, matches the issue's asks 1-3.
2. An `extractAudio` step that remuxes a video bed into the work dir. More code and a copy per run; `-vn` in the
   music track already reads only the audio, so nothing needs extracting.

Option 1.
