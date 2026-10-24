---
change_id: blog-emoji-text-signs-712
status: planned
---

# Plan: the emoji rule passes text-style ©, ® and ™ (issue #712)

Input: change.md, research.md. Complexity: small, one phase.

## Phase 1: pattern, tests, docs

Files: `modules/blog/src/quality/text.ts`, `modules/blog/src/quality/rulesets/{en,pl}/ruleset.ts`,
`modules/blog/tests/quality/copy.test.ts`, `modules/blog/CHANGELOG.md`, `modules/blog/README.md` (if it describes the
rule).

1. Test first: `checkCopyText` on `© 2026 Plan`, `®`, `™` gives no `emoji` finding (en and pl); `©️` and `🚀` do.
2. `emojiPattern()` in `text.ts`: a fresh `/(?![©®™](?!️))\p{Extended_Pictographic}/gu`.
3. Both rulesets use it.
4. CHANGELOG `## Unreleased` entry.

## Decisions (auto)

- Exclude only the three signs, not every text-default pictograph → keeps `❤`/`☀` flagged (issue scope, safer).
- One helper returning a new RegExp, like `wordPattern`, so the two rulesets share no global regex state.

## Progress

- [ ] Phase 1: pattern, tests, docs
