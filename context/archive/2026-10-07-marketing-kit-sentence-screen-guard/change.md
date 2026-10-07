---
change_id: marketing-kit-sentence-screen-guard
title: "A film's screen guard can prove each number was on screen when the voiceover said it"
status: archived
roadmap_item: none
issue: "#176"
branch: claude/project-thread-y0iqd3
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close [issue #176](https://github.com/SOFTURE/AI/issues/176), found in FIRE_TRACKER SF-1 on marketing-kit 0.1.6 while
rehearsing 6 scene types before paying for 53 voiceovers.

1. **Rehearsing a scene before paying** needed a fake-provider script, a separate cache directory and a copy of
   `marketing.json` kept out of git by hand. After this change an author knows that `--placeholder` (0.1.8) is that
   rehearsal: no script, no config copy, nothing in `voice.cacheDir`.
2. **`checkScreen` checks every phrase at once.** A film whose later sentence reveals a number fails a `checkScreen`
   placed earlier, and moving it to the end no longer proves the earlier numbers were on screen when the voiceover
   said them. After this change a sentence can carry its own phrases (`beats[].screenGuard`), checked when that
   sentence ends or at a `checkScreen` inside it; the video's list keeps its meaning (checked at `checkScreen`).

Done when: a sentence's phrases stop the recording with exit code 2, naming the sentence, when they are not on
screen at its end; a `checkScreen` inside the sentence checks them at that moment instead; a film whose phrases all
live on its sentences needs no video-level list and no `checkScreen`; existing configs load and record as before;
the README documents both the per-sentence guard and `--placeholder` as the pre-payment rehearsal.

## Context

- The issue's first suggestion (`record <video> --fake-voice` writing into `<output.buildDir>/<video>/fake-voice/`,
  never `voice.cacheDir`) shipped as `--placeholder` in 0.1.8 (CF-2, `src/voice/placeholder.ts`): `all`, `record` and
  `render` take it, the voiceover is written into `<output.buildDir>/<video>/placeholder/` under a marked key, the
  CLI prints a line saying nothing was paid, and a placeholder recording never renders with the paid voiceover.
  The issue was filed against 0.1.6, before that. Nothing else is needed for part 1 beyond saying so in the README
  where an author looks before paying (the voiceover section).
- The screen guard today (`src/record/record.ts`, `checkScreen`): reads `app.screenGuardSelector`'s text and
  requires every `videos[].screenGuard` phrase; the recording fails when `checkScreen` was never called.
  `src/config/schema.ts` requires at least one video-level phrase and, for an actions scene, a `checkScreen` action.
- Research and framing are skipped: the issue names the design, and the code paths are two files.

## Constraints

- Neutral wording in the repository and on GitHub.
- No release in this change: the package version moves to 0.1.9 and the owner publishes.
- Issue #175 (marketing-kit `fill` on a prefilled field) runs in a sibling thread and touches `record.ts`, the
  action schema and the README too; whichever merges second merges master and resolves.
