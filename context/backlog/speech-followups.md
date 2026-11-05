# Speech follow-ups

- [x] 2026-11-02 speech-transcription-956: `transcribe` takes no abort signal; a jobs handler cannot stop a long transcription between chunks when its `context.signal` aborts (minor) foundation/speech/src/create-transcriber.ts (done in #1100, speech-transcribe-abort-1100)
