---
change_id: config-language-quote-marker-517
title: "config: the language gate skips a marked verbatim quote in Markdown (issue #517)"
status: archived
roadmap_item: null
issue: 517
branch: claude/project-thread-hyjor3
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

Close [issue #517](https://github.com/SOFTURE/AI/issues/517): workflow artifacts under `context/` quote the owner
verbatim in the owner's language, and `softure-check-language` rejects those lines with no way out short of dropping
every check of `context/`. An app needs a way to exempt exactly the quote and keep the rest of the file checked.

## Context

`@softure-ai/config` is at 0.1.2 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG
gets `## Unreleased`. Issue #518 (lefthook preset override) follows in this thread after this change merges.

## Constraints

- Every other line of a file stays checked; the exemption covers only the marked text.
- An unclosed marker must not silently exempt the rest of a file.
- No behaviour change for a file without markers.

## Notes

- Framing: skipped. The issue names the problem and three concrete options.

## Decisions (auto)

- Take the inline marker option: `<!-- language: pl -->` … `<!-- /language -->` in Markdown files, on one line or
  across lines. It exempts exactly the quote, works for `git ls-files`, staged files and `--all` alike, and is
  invisible in rendered Markdown.
- No `--exclude <glob>`: the marker solves the issue without dropping a whole file, and a glob matcher would be new
  code with no second use yet. No `verbatim:` heuristic: it would guess at prose shapes.
- A marker inside a Markdown code span is text, not a marker (docs can show it). An opening marker with no closing
  one is a hit on its line ("unclosed language marker"); a stray closing marker is ignored.
- Markdown only, like the code span rule: in code files an HTML comment is not a comment.
