---
change_id: marketing-kit-music-file-1020
verdict: approved
---

# Plan review: marketing-kit-music-file-1020

- Covers the four asks: declared name / type on the source, a skipped check for an extensionless path, video beds,
  tests for an extensionless `.m4a` and `.mp4` with sound.
- Compatibility: the new fields are optional; every 0.5.0 film keeps its behaviour except that `.mp4`, `.m4v`, `.mov`
  and `.webm` beds now pass (a widening the issue asks for). `-vn` changes the music track only by dropping a video
  stream the mp3 output could not hold anyway (or held as cover art nobody hears).
- Safety: skipping the type check does not let junk through, since `probeAudio` refuses a file without an audio
  stream or a duration with a named reason, before anything is paid for.
- `checkMusicFileType` with an extensionless name alone now answers "needs a file name or a content type" instead of
  "not a music file"; both refuse, the new message is the accurate one.
- Tests use real ffmpeg like the existing pipeline cases. Approved without changes.
