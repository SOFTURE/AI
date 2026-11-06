---
change_id: marketing-kit-bound-film-mix
status: archived
---

# Plan: bound the footage film's mix

Files: `tools/marketing-kit/src/footage/film-mix.ts`, `film-mix.test.ts`, `CHANGELOG.md`.

- `apad` becomes `apad=whole_dur=<length>`; the output gets `-t <length>`; the trim stays.
- A length that is not finite and positive throws (a bug, not an expected failure).
- Tests: the argument tests carry the new bounds; a test for 0, -1, NaN and Infinity.

## Decisions (auto)

- Three bounds rather than one: the failure did not reproduce, so the fix does not rely on any single filter.

## Progress

- [x] Phase 1
