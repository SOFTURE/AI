# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/speech`. When an app has run a version
in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- The first version (#956): `createTranscriber` turns any audio or video into a transcript with segments, through a
  Groq, OpenAI or OpenAI-compatible Whisper provider. ffmpeg normalizes the input to mono 16 kHz and cuts long inputs
  into overlapping chunks, stitched back with corrected timestamps. Failures are stable codes (`speech.too_long`,
  `speech.unsupported_format`, `speech.provider_refused`, `speech.rate_limited`, `speech.timeout`,
  `speech.unavailable`). `toSrt`, `toVtt` and `toParagraphs` format the segments; `onUsage` reports the seconds and
  the cost of every call; `@softure-ai/speech/testing` has `fakeTranscriber()`.
