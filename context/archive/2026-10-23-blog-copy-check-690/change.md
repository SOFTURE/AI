---
change_id: blog-copy-check-690
title: "blog: a voice check for copy that is not an article (issue #690)"
status: archived
roadmap_item: null
issue: 690
branch: claude/project-thread-ipcfvp
created: 2026-10-23
updated: 2026-10-23
archived_at: 2026-10-23
---

## Intent

Close [issue #690](https://github.com/SOFTURE/AI/issues/690): the blog's quality gate checks articles only
(`checkArticle` / `checkArticleText` need a frontmatter). An adopting app also publishes copy that is not an
article (landing and calculator text, posts pasted into forums and social networks, list mails) and had to
compose the exported primitives into its own checker. Export `checkCopyText(text, options)` that runs the
ruleset's patterns, the app's voice and the prose rhythm rules over plain paragraphs, with a `channel` mode
that flags markdown which a plain-text editor shows as noise, and add the rules the issue measured.

## Context

Labels: `enhancement`, `pkg: blog`. Touches `modules/blog` only (`src/quality/`, the writing skill's rules
template, tests, README, CHANGELOG). Product text stays English; the Polish ruleset's word lists are language
data under `pl/`. No release in this change: the coordinator releases in the next batch.

## Constraints

- `checkArticle` keeps its behaviour except for the new rules the issue asks for; existing rule ids, severities
  and messages do not change.
- New rules join the rule catalog and the writing skill's rules table when the article gate can report them.
- Rules are data the app can tune: `quality.severity` overrides and `voice.phrases` apply to copy too.

## Out of scope

- A `softure-blog check --copy` CLI command: the issue asks for a function.
- Changes in the adopting app (it keeps its own checker until a release ships).

## Notes

- Framing: skipped. The issue names the problem, the API and the rules.
