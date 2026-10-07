---
change_id: seo-robots-extra-directives
title: "seo: extra robots.txt directives in every group, and signed IndexNow requests (issue #194)"
status: archived
roadmap_item: null
issue: 194
branch: claude/project-thread-7hxh6u
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close both points of issue [#194](https://github.com/SOFTURE/AI/issues/194), found while an adopting app planned to
move its `robots.txt` onto `@softure-ai/seo@0.1.5`:

1. The app writes `Content-Signal: ai-train=yes, search=yes, ai-input=yes` in every group of its `robots.txt` and its
   production check asserts the line. `RobotsRule` has no field for extra directives, so the app loses the line or
   post-processes the result.
2. `submitToIndexNow` sends only `content-type`; an app that signs its requests (web-bot-auth) needs to know that
   `fetchImpl` is the place for a signing fetch.

A reviewer checks `modules/seo/tests/robots.test.ts`, `tests/module.test.ts`, the README and the version bump
(seo 0.1.6).

## Context

- `modules/seo/src/robots.ts` builds every group itself from `robots.allow` / `robots.disallow` and the crawler
  categories, so a per-rule field the app fills is not reachable: the app does not write the rules. The option has to
  live in the module's options and be copied into the groups.
- Next's `MetadataRoute.Robots` rules accept `other?: Record<string, string | string[]>`; Next writes each entry as
  `key: value` lines inside the group. `RobotsRule` is a structural copy of that type.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo ("an adopting app").
- Backward compatible: the new option is optional and the default output is unchanged byte for byte (no `other` key
  when nothing is set).
- Only `@softure-ai/seo` changes. Bumps 0.1.5 → 0.1.6; the thread releases it after the merge if no other open change
  touches seo.

## Process notes

- Research: skipped as a separate artefact. The issue names the two files; the reading needed (`robots.ts`,
  `options.ts`, `server/indexnow.ts`, Next's robots serializer, the seo tests) is summarised in `plan.md` § Findings.
- Framing: skipped. Point 1 is one missing option with the observed effect named in the issue; point 2 is a README
  line about an existing option.
