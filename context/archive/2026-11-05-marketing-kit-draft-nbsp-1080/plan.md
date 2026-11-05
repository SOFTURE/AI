---
change_id: marketing-kit-draft-nbsp-1080
status: archived
---

# Plan: keep no-break spaces in the draft's ASS (issue #1080)

Input: change.md, research.md. Complexity: trivial (one function, its test, changelog).

## Phase 1: fix and tests (TDD)

Files: `tools/marketing-kit/src/footage/draft.ts`, `tools/marketing-kit/src/footage/draft.test.ts`,
`tools/marketing-kit/CHANGELOG.md`.

- Test first: a `phrase` and a `highlight` film whose word holds U+00A0 yield `\h` in the Dialogue text, while a run of
  other white space still collapses to one space.
- `toAssText`: collapse `[^\S ]+` to a space, trim the ordinary spaces at the ends, then write U+00A0 as `\h`.
- Changelog `## Unreleased` entry.

## Decisions (auto)

- Only U+00A0 becomes `\h`, as the issue asks (research option 1).

## Progress

- [x] Phase 1: fix and tests
- [x] Implementation review
