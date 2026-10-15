---
change_id: ui-checklist-row-link-506
status: active
---

# Plan: Checklist row links, trailing adornment, linked done items (issue #506)

Input: change.md, research.md. Complexity: small (one component, tests, docs).

## Phase 1: `rowLink`, `trailing`, `linkDone` (TDD)

Files: `foundation/ui/src/ui/checklist.tsx`, `foundation/ui/tests/checklist-row-link-506.test.tsx`.

1. Tests first: `linkDone` links a done item with `href` and names it "… (done)"; without it a done item stays text;
   `rowLink` puts the marker, the description and the trailing node inside the one link (row slot class applied,
   `LinkComponent` used); a row with no `href` under `rowLink` has no link but still shows `trailing`; the function
   form of `trailing` gets `isLink`; the default render has no `row` element and no trailing span.
2. Implement: `isLink = item.href !== undefined && (!item.done || linkDone)`; extract the row content (marker, body,
   trailing); wrap it in the link with slot `row` when `rowLink` and `isLink`, else render it in the `<li>` as today.

## Phase 2: docs

`foundation/ui/README.md` (checklist paragraph, slots `row`, `trailing`), `foundation/ui/CHANGELOG.md` `## Unreleased`.

## Progress

- [ ] Phase 1: `rowLink`, `trailing`, `linkDone`
- [ ] Phase 2: docs
