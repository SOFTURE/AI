---
change_id: blog-regex-redos
title: "fix(blog): linear-time block patterns in the quality gate (code-scanning #65, #66, #67)"
status: archived
roadmap_item: null
issue: 1109
branch: claude/project-thread-ja4xnq
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close the three CodeQL `js/polynomial-redos` alerts (#65, #66, #67; issues #1109, #1110, #1111) in
`modules/blog/src/quality/blocks.ts`. The heading, list item and footnote definition patterns end in `\s+(.*)$` or
`\s*(.*)$`; a line with a long whitespace run, some text and a line separator (U+2028, U+2029 or a bare CR) makes them
backtrack in quadratic time, so one crafted article line stalls the quality gate. The outcome: `splitBlocks` runs in
linear time on such lines and splits ordinary Markdown exactly as before.

## Context

Coordinator brief (2026-11-06 01:40 UTC): one pull request for #1109, #1110 and #1111, a `## Unreleased` changelog
entry; the fix rides the next combined release. Files: `modules/blog/src/quality/blocks.ts`, a new
`modules/blog/tests/quality/blocks.test.ts`, `modules/blog/CHANGELOG.md`.

## Constraints

- English only. No change to the blocks an ordinary article produces.

## Notes

- Framing: skipped. The alerts name the rule, the file and the lines.

## Done

- `splitBlocks` patterns match only the block marker; the text is sliced from the line. Linear time on the crafted
  lines the alerts describe (regression test `modules/blog/tests/quality/blocks.test.ts`).
- `@softure-ai/blog` carries a `## Unreleased` entry and rides the next combined release.
