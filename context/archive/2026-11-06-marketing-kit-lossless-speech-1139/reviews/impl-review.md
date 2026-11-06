# Implementation review: marketing-kit-lossless-speech-1139

Verdict: approved.

- Lossless: every intermediate speech file is WAV (`clip-sound.ts` 24-bit for the providers, `getAudioCodecArgs` float
  for the chain); the transcribe test lists `audio/` with no `.mp3`, the e2e render test checks the build folder.
- Pre-gain: measured after the same `aformat` the extraction uses, so a mono clip's up-mix is counted; the cap uses
  the true peak, stricter than the issue's sample peak. A silent or soundless clip is left at 0 dB.
- Isolator input: the whole-clip path sends `audio/<clip>.wav`, the range path cuts from it; the provider's MP3 answer
  stays in the cache under its old key (no repeated payment) and is decoded once for the build.
- The acceptance check discriminates: with MP3 encodes swapped in, the sample difference rises from under -40 dB to
  -1.4 dB and the test fails.
- Compatibility: signatures of `getSpeechChainFiles` and `mixFootage` unchanged; builders keep encoding `.mp3` names
  as MP3, so the draft (#1143, `draft.ts`) works before and after its own change.
- Risk accepted: ranges cached earlier were cleaned from the un-gained sound; documented in the README.
