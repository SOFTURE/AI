---
change_id: marketing-kit-bound-film-mix
title: "marketing-kit: bound the footage film's mix so it can never run unbounded"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-15z9hz
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Master CI on d23fb32 failed once in "marketing-kit footage film in the worker image": the film's mix
(`buildFilmMixArgs`) wrote a 90 GB WAV until the runner's disk was full. The same tree passed on its pull request, on
the next two master commits and locally (155 s), so the cause did not reproduce. Bound the mix's length so no single
filter's end of stream decides it, and fail at once on a film length that is not a positive number.

## Notes

- Research: skipped. The failing job log, the graph (`apad` without a length, then `atrim=duration`) and the four
  green runs of the same tree are the whole input; an `atrim` duration of 0 (no limit) is the only known way the
  graph runs unbounded.

## Done

`buildFilmMixArgs` pads to `whole_dur`, trims and caps the output with `-t`, and throws on a non-positive or
non-finite length. Ships in the next combined marketing-kit release.
