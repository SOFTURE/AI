---
change_id: marketing-kit-declick-repair-1170
title: "marketing-kit: the speech declick repairs single impulses and no longer gates speech (issue #1170)"
status: archived
roadmap_item: null
issue: 1170
branch: claude/project-thread-1j7ztj
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1170](https://github.com/SOFTURE/AI/issues/1170): the footage speech declick (`film.speech.declick`,
#1084) is in practice a 15/20 dB gain gate on the pauses between transcript words. The transcript's word boundaries
are 20 to 60 ms off the real sound, so the gate lowers decays and onsets and is heard as hoarseness and pumping.
Replace it with local repair of single impulses: no gain gate at all, nothing changed within ±80 ms of a word, an
impulse replaced by AR (LPC) interpolation with a short crossfade, and a report of each repair (count, times).

## Context

Labels: `pkg: marketing-kit`. A parallel thread carries #1172 (cover text bounds) in the same package; both ship in
one marketing-kit release, dispatched by whichever thread merges last. No version bump in this pull request.

## Constraints

- The default stays `off`; `gentle` and `strong` keep their names (configs keep loading) but only repair impulses.
- Speech inside every word window (±80 ms) is bit-identical to the input.
- No test talks to an external service.

## Notes

- Framing: skipped. The issue names the cause, the fix and the acceptance check.

## Done

The speech declick changes no gain: nothing within ±80 ms of a transcript word is touched, and each single impulse
in a longer pause is replaced by least-squares AR interpolation with a 3 ms crossfade; the report lists every repair.
The envelope regression test from the issue guards it. Next marketing-kit release (with #1172).
