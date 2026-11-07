---
change_id: marketing-kit-mouth-clicks-1182-1183
title: "marketing-kit: an exported mouth-click detector with the speech protection zone, and a declick repair level with a minimum pause and limits (issues #1182, #1183)"
status: archived
roadmap_item: null
issue: [1182, 1183]
branch: claude/project-thread-mvljs3
created: 2026-11-07
updated: 2026-11-07
archived_at: 2026-11-07
---

## Intent

Close [#1182](https://github.com/SOFTURE/AI/issues/1182) and [#1183](https://github.com/SOFTURE/AI/issues/1183)
(stages A and B of #1170). One shared impulse rule (1-25 ms, 2-10 kHz energy more than 12 dB over the ±50 ms median,
not periodic, over within its length) and one shared speech protection zone (word bounds widened to the real sound by
energy, ±80 ms, and nothing where the 10 ms energy is above -45 dBFS with the candidates' own samples left out):

- stage A: `findMouthClicks` and `MOUTH_CLICK_RULES` exported, with each word's bound on the real sound and a
  quiet-stretch check; no audio processing;
- stage B: a third active declick level `repair` that repairs only clicks in pauses of at least 150 ms after the
  guard, outside the protection zone, within the limits (25 ms per repair, 3 a second, 1 % of the track), and reports
  what it skipped (`skippedLimit`).

## Context

Labels: `pkg: marketing-kit`. Both issues share the detector, so one pull request. This thread releases marketing-kit
after the merge (0.19.0 already shipped #1181).

## Constraints

- `gentle` and `strong` behave exactly as in 0.18.0; the default stays `off`.
- Every sample outside a repair and its crossfades is unchanged.
- No test talks to an external service.

## Notes

- Framing: skipped. Both issues name the rules, the API and the acceptance tests.

## Done

`findMouthClicks` and `MOUTH_CLICK_RULES` give an app the mouth clicks outside the speech protection zone, each
word's bound on the real sound and a quiet-stretch check (#1182). The declick level `repair` repairs the same
impulses only in pauses of 150 ms or more after the guard, outside the zone, within 25 ms per repair, 3 a second and
1 % of the track, and reports the rest as `skippedLimit` (#1183). PR #1186. Next marketing-kit release.
