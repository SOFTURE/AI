---
change_id: privacy-legal-layout
title: "privacy: LegalDocument and LegalFooter can reproduce an app's own legal page layout (issue #215)"
status: archived
roadmap_item: null
issue: 215
branch: claude/project-thread-7gbk14
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close [issue #215](https://github.com/SOFTURE/AI/issues/215): an app adopting `@softure-ai/privacy` 0.1.6 could
replace its own legal section with `LegalSection`, but not its document frame and footer, because the components
force markup and text the app's legal pages do not have. After this change an app can render its terms and privacy
policy with the package and keep the text and the look exactly as they were:

1. `LegalDocument` without a title renders no `<h1>`, so the app's page frame owns the heading; the `<header>` is
   rendered only when it has something in it.
2. The meta line ("Version X · in force since <date>") is optional: the app passes its own node through `meta`, or
   `meta={null}` for none, instead of `version` and `effectiveFrom`.
3. A change history entry may have no version and no date; it then renders only its summary.
4. The contents heading element is configurable (`contentsTitleAs`), the sections and history sit in a `body` slot so
   the contents can form a sticky side column, and the history can be listed in the contents.
5. `LegalFooter` takes `as` (`footer`, `div`, or `nav` for the navigation alone), so it fits inside a site footer
   without a nested landmark.
6. `LegalFooter` takes an optional `separator` rendered between links.

A reviewer checks `modules/privacy/src/ui/{legal-document,legal-footer}.tsx`, `modules/privacy/tests/legal-document.test.tsx`,
the README (§4, §8) and CHANGELOG, and the version bump to 0.1.7.

## Context

- `LegalDocument` always renders `<article><header><h1>…` and the meta line; `LegalChange` requires `version` and
  `date`; the contents title is always an `<h2>`; sections are direct children of `<article>`.
- `LegalFooter` always renders `<footer><nav><ul>` with no separator.
- The adopting app's frame renders the title and its own "in force since" sentence above the document, a contents
  column (a plain label, sticky from `lg`) beside the sections, the history as finished sentences listed in the
  contents, and the two links inline with " · " inside its site footer.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- Existing callers keep working unchanged: every new option defaults to today's output, except the new `body` wrapper
  around the sections (same visual spacing by default).
- English-only code and docs; neutral wording on GitHub and in the repo ("an adopting app").
- Only `@softure-ai/privacy` changes; no other open change touches it (#202 / PR #209 changes feature-switches only).
  The change bumps privacy 0.1.6 → 0.1.7 and this thread releases it after the merge.

## Process notes

- Research: skipped as a separate artefact. The issue names both components and every gap; the reading needed
  (the two component files, their test, README §4 and §8, the adopting app's own frame and footer for the target
  markup) is summarised in `plan.md` § Findings.
- Framing: skipped. The problem (components force markup the app cannot accept) and the asks are measured in the
  issue; the open choices (prop shapes) are plan decisions.
