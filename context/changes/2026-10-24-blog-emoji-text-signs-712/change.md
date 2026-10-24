---
change_id: blog-emoji-text-signs-712
title: "blog: the emoji rule passes text-style ©, ® and ™ (issue #712)"
status: open
roadmap_item: null
issue: 712
branch: claude/project-thread-749chz
created: 2026-10-24
updated: 2026-10-24
---

## Intent

Close [issue #712](https://github.com/SOFTURE/AI/issues/712): the `emoji` rule of the copy rulesets stops flagging the
copyright, registered and trade mark signs written as text, so a footer such as `© 2026 Product name` passes
`checkCopyText`. Real emoji, and these signs in emoji presentation (followed by U+FE0F), stay errors.

## Context

- Labels: `bug`, `pkg: blog`. Found by an adopting app that runs the check on rendered page text.
- Both rulesets (`en`, `pl`) use `/\p{Extended_Pictographic}/gu`, which contains U+00A9, U+00AE and U+2122.

## Constraints

- No version bump; the coordinator releases. CHANGELOG gets an `## Unreleased` entry.
- Other text-default pictographs (for example U+2764, U+2600) keep being flagged: the issue names only the three signs.

## Notes

- Framing: skipped. The issue names the cause, the fix and the tests.
