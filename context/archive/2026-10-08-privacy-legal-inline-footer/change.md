---
change_id: privacy-legal-inline-footer
title: "privacy: inline LegalFooter and unique LegalDocument ids (issue #241)"
status: impl_reviewed
roadmap_item: null
issue: 241
branch: claude/project-thread-9lpemh
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Close the two gaps of [#241](https://github.com/SOFTURE/AI/issues/241) in `@softure-ai/privacy`:

1. `LegalFooter` gets an inline form (`as="p"` or `as="span"`): the links and separators as inline content of one
   element, with no `nav`, `ul` or `li`, and the separator read as plain text. The list form stays the default.
2. `LegalDocument` names its contents navigation by an id from `useId()`, so two documents on one page no longer
   share `legal-contents-title`.

The minor note of the issue (the root is always `<article>`) is taken too: `LegalDocument` takes `as`
(`article` default, `div`, `section`), matching `LegalFooter`.

A reviewer checks `modules/privacy/tests/legal-document.test.tsx`, the README § 4 and § 8 lines, the CHANGELOG and
the version bump (privacy 0.1.9).

## Context

- `LegalFooter` (`modules/privacy/src/ui/legal-footer.tsx`) always renders `Root > nav[aria-label] > ul > li`; the
  separator sits in an `aria-hidden` span. An adopting app writes its legal links as one paragraph inside a footer
  that already is a landmark, so the extra `nav` and list are noise for assistive technology.
- `LegalDocument` (`modules/privacy/src/ui/legal-document.tsx`) uses the constant `CONTENTS_TITLE_ID`. The change
  history section uses the constant `legal-changes` as its anchor, the same duplicate on a page with two documents.
- 0.1.8 is published; the next version is 0.1.9. No other open change touches privacy.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: every new prop is optional and the default markup is unchanged, except the contents title
  id, which was internal (nothing outside the component referenced it).
- Server components stay server components (`useId` is allowed there).

## Process notes

- Research: skipped as a separate artefact. The issue names both files and the exact constructs; the reading
  needed fits in `plan.md` § Findings.
- Framing: skipped. The issue reports concrete markup gaps with their accessible effect and proposes the fix; there
  is no competing explanation to weigh.
