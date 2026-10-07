# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/marketing-kit`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`marketing-kit@x.y.z`).

## Unreleased

- `beats[].screenGuard`: a sentence's own phrases, checked while that sentence is on screen (at a `checkScreen` inside
  it, or when it ends), so each number is proven on screen when the voiceover says it. The video's `screenGuard` is
  still checked at every `checkScreen` and may be left out, with the `checkScreen`, when the sentences carry every
  phrase. A 0.1.8 `marketing.json` works as it is.
- README: `record <video> --placeholder` (0.1.8) is the rehearsal before paying; a script that recorded fake
  voiceovers into a second cache with a copy of `marketing.json` can go.

## 0.1.8

- Described in the GitHub Release `marketing-kit@0.1.8`.
