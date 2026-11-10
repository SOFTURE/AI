---
change_id: marketing-kit-caption-ranges
title: "marketing-kit: caption boxes for a stretch of film time (EDL captionRanges)"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-caption-ranges
created: 2026-11-10
updated: 2026-11-10
---

## Intent

An adopting app must lift its captions off an object the speaker holds to the camera for part of a segment (about a
second) without moving the captions of the whole segment, which may also hold the opening hook. Today a caption box can
only move per segment (`segments[].caption`). Add an optional EDL field `captionRanges[]`: `{ from, to, bottom?, top? }`
in film seconds; the captions that start inside a range take its box, over the segment's.

## Context

Gap found by an adopting app while carrying its item "captions clear of objects". Owner's standing order there: a gap
in a SOFTURE package is fixed in the package, released, and bumped in the app.

## Constraints

- An EDL without `captionRanges` drafts, renders, validates and diffs exactly as before.
- The draft and the render place a chunk alike (one function).
- An overlay keeps clear of every caption box on screen while it shows.

## Notes

- Framing: skipped. The gap is a missing field with one obvious shape (the segment's `caption` by time).
