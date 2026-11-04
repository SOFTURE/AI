# Research: marketing-kit-music-file-1020

## What the code does

- `src/footage/film.ts`: `MusicSource` file branch is `{ kind: "file"; path: string }`; nothing else about the file.
- `src/footage/pipeline.ts` `checkMusicFile(path)`: existence, then `checkMusicFileType({ fileName: path })`, then
  `probeAudio`. Called from `prepareFootage` before any clip is normalized.
- `src/footage/audio.ts` `checkMusicFileType`: `extname(fileName)` is `""` for an extensionless name, which is not
  `null`, so it is looked up in `MUSIC_FILE_TYPES` and refused, even when a valid `contentType` is also given.
- `src/footage/render.ts` `buildMusicArgs`: `-stream_loop -1 -i <bed> -t <s> -af … -c:a libmp3lame <out>.mp3`.
- `src/config/config.ts` `resolveMusicSource`: `music.file` in `marketing.json` → `{ kind: "file", path }`.

## Measurement

`ffmpeg -stream_loop -1 -i clip.mp4 -t 2 -af volume=0.5 -c:a libmp3lame out.mp3` on an h264 + aac clip succeeds and
writes an audio-only mp3 (ffmpeg 6, the mp3 muxer drops the h264 stream), so the render already takes a video bed as
0.4.0 did: only the type check refuses it. An extensionless copy of an `.mp4` probes the same with ffprobe (the
container is sniffed, not named).

## Options

1. Optional `fileName` / `contentType` on the file source; skip the type check when the source says nothing and the
   path has no extension; accept video containers as beds (the render needs no change). Small, matches the issue's asks 1-3.
2. An `extractAudio` step that remuxes a video bed into the work dir. More code and a copy per run; the music track
   already reads only the audio, so nothing needs extracting.

Option 1.
