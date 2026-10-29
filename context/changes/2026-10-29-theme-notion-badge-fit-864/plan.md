---
change_id: theme-notion-badge-fit-864
status: in_progress
---

# Plan: Badge and Status fit a narrow container (issue #864)

Input: change.md, research.md. Complexity: small (two class strings, one wrapper span, tests, docs).

## Phase 1: classes and markup (TDD)

Files: `src/ui/badge.tsx`, `src/notion/Status.tsx`, `tests/ui/badge.test.tsx`, `tests/notion/Status.test.tsx`,
`tests/upstream/deltas.ts`, `tests/fixtures/notion-slots.json`.

1. Tests first: every badge carries `max-w-full` (and keeps `w-fit`, `whitespace-nowrap`); `Status` wraps its word in
   `<span data-slot="status-label" class="min-w-0 truncate">`, keeps the icon from shrinking (`[&>svg]:shrink-0`), and
   sets `title` to the word when it is a string or a number (none for other nodes; an explicit `title` wins).
2. Badge base gains `max-w-full`; the upstream delta records it. `StatusProps` gains an optional `title`.
3. Refresh the parity fixture.

## Phase 2: a geometry check in a browser

`visual/fit.spec.ts`: open the built gallery, put a copy of a rendered `Status` and `Badge` with a long word into a
120 px wide parent, and assert each badge's box stays within the parent, the label is cut with an ellipsis
(`scrollWidth > clientWidth`, `text-overflow: ellipsis`) and the icon keeps its 16 px. No screenshot, no baseline.

## Phase 3: docs

README (Status and Badge in a narrow container), CHANGELOG `## Unreleased` with what an app drops.

## Phase 4: design system artifact

Patch `Badge` and `Status` in the published bundle and the bundle.css classes; render-check light and dark.

## Decisions (auto)

- `Badge` gets only `max-w-full` (the issue's proposal): it can no longer leave its container; its own text is clipped,
  not ellipsized, since a bare text node cannot carry an ellipsis and wrapping children would break `asChild` and the
  upstream parity. An app that wants an ellipsis in a plain `Badge` wraps the text in `<span className="truncate">`
  (documented).
- `Status` sets `title` for string and number words so the full text is reachable on hover; a `title` prop overrides.
- `data-slot="status-label"` on the span, so apps and tests can address the word.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Implementation review
