---
change_id: marketing-kit-overlays-1200
title: "marketing-kit: footage EDL overlays on words, and hyperframes 0.9.20 (issue #1200)"
status: in_progress
roadmap_item: null
issue: 1200
branch: claude/project-thread-1p9fy6
created: 2026-11-07
updated: 2026-11-07
---

## Intent

Close [#1200](https://github.com/SOFTURE/AI/issues/1200): an EDL's optional `overlays[]` (punch-in on a word, keyword,
lower third, short list, arrow, highlight) on a transcript word or a film second, in the brand's colours and fonts,
drawn by the render (markup adapted from HyperFrames registry blocks, vendored) and the draft alike, with guards that
refuse what cannot be drawn cleanly; the hyperframes pin moves to 0.9.20.

## Context

Labels: `pkg: marketing-kit`. Same thread and release as #1199 (merged in PR #1201).

## Constraints

- An EDL without overlays renders and drafts byte-identically.
- No network at render time; no test talks to an external service.

## Notes

- Framing: skipped. The issue names the kinds, the fields, the guards and the tests.
