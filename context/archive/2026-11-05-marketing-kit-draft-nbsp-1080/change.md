---
change_id: marketing-kit-draft-nbsp-1080
title: "marketing-kit: keep no-break spaces in the footage draft's ASS captions (issue #1080)"
status: archived
archived_at: 2026-11-05
roadmap_item: null
issue: [1080]
branch: claude/project-thread-751r11
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1080](https://github.com/SOFTURE/AI/issues/1080): `toAssText` in
`tools/marketing-kit/src/footage/draft.ts` collapses `\s+` into a plain space, and `\s` matches U+00A0, so a caption
word joined with a no-break space can wrap in the draft while the render's HTML keeps it together. Keep U+00A0 and
write it as ASS's hard space `\h`; collapse only the other white space.

## Context

Owns `tools/marketing-kit/src/footage/draft.ts`, its test and the package changelog. Parallel threads also edit
`draft.ts` (#1077, #1081); conflicts are resolved at merge time.

## Constraints

- No version bump: the changelog gets an `## Unreleased` entry; the coordinator releases the batch.

## Notes

- Framing: skipped. The issue names the cause, the fix and the test.
