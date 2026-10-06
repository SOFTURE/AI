# Implementation review: marketing-kit-film-followups

Verdict: **approved**. No blocking findings; two notes recorded.

## Against the plan

| Phase | Planned | Done | Evidence |
| --- | --- | --- | --- |
| 1 | `hook.transition` (fade default, rewind, cut); rewind without flicker; 0 s for a cut | yes | `timeline.ts` `transitionFrames`, `crossfadeArgs`, `getTransitionSeconds`; `compose.ts` omits the clip for a cut; `tests/transition.test.ts` measures 0.8 s and 24 frames with real ffmpeg for 2 and 5 stills |
| 2 | per-video folder, flat 0.1.x files still found, stale files listed | yes | `cache.ts` `getVoiceoverPaths(…, videoId)`, `findStaleVoiceovers`; tests use the key of a real input (`d6944f24f8cf2a5f`, computed outside the code) and check that no provider call is made |
| 3 | `videos[].today`, `--today` overrides, real calendar days only | yes | `day.ts` `isCalendarDay`, `getRecordingDay`; config and options tests (2026-02-29 refused, 2028-02-29 accepted) |

Docs: README (commands, config table, A film, the cache layout, FIRE migration), the fixture config uses all
three transitions and pins its day, JSON Schema regenerated, version 0.1.6.

## Verification

- Gates: typecheck, lint, test, build green.
- The opt-in end-to-end render (`MARKETING_KIT_RENDER=1`, Chromium from `/opt/pw-browsers`) passed: the fixture film
  renders with the fade (frames 3.6-4.8 s inspected: a smooth cross-fade, no flashing screens), the desktop film
  with a cut has no transition clip, and the flat fixture cache is found through the fallback.

## Findings

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| I1 | A build folder rendered by 0.1.5 keeps its old `assets/rewind.mp4`; nothing references it. | note | Accepted: build folders are regenerated output, not committed. |
| I2 | The default opening changes from rewind to fade for every film rendered again. | note | Accepted in the plan review (P1); the README says so and how to keep the rewind. |

## Manual checks for the owner

- Watch FIRE's film rendered again with 0.1.6 (`hook.transition` unset): the opening should fade, not flicker. If
  the rewind is preferred, set `"transition": "rewind"` and compare.
