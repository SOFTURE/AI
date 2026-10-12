---
change_id: blog-method-sections
title: "blog: the method page takes the app's own sections with rich bodies (issue #380)"
status: implementing
roadmap_item: null
issue: 380
branch: claude/project-thread-vvxi82
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #380](https://github.com/SOFTURE/AI/issues/380). `BlogMethodView` renders each section of "How our texts
are made" as one `<p>` from the `messages.method.*` strings, so an app whose method page needs a bullet list of its
checks, a link to its calculator or a `mailto:` address for corrections keeps its own page.

After the change `BlogMethodPage` and `BlogMethodView` take `sections`: the app's own sections, each `{ id, title, body }`
with a `ReactNode` body, in place of the default five. The AI disclosure section (with `aiDisclosure`) still opens the
page and the footer note still closes it.

A reviewer checks `modules/blog/tests/adoption-gaps-380.test.tsx`, the README section "The package's views in the app's
look" and the CHANGELOG entry.

## Context

Issue #380 (labels `enhancement`, `adoption`, `pkg: blog`), filed while adopting `@softure-ai/blog` 0.1.11. No
roadmap: work comes from GitHub issues. #379 on the same package is merged (PR #389, `0949d88`). The change goes under
`## Unreleased` and rides the next release (releases are batched by the coordinator).

## Constraints

- Without `sections` the page renders exactly as today.
- The AI disclosure cannot be dropped by passing sections: it is a legal notice (AI Act art. 50(4)).
- English-only code, tests and docs.

## Notes

- Framing: skipped. The issue names the component and proposes the shape; the open choices are settled in plan.md.
