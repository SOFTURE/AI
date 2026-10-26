---
change_id: ui-disclosure-panel-links-777
status: open
---

# Plan: DisclosureMenu panel link rules yield to a link's own classes (issue #777)

Input: change.md, research.md. Complexity: small (one class string, a test, docs).

## Phase 1: zero-specificity panel link rules

Files: `foundation/ui/src/ui/disclosure-menu.tsx`, `foundation/ui/tests/disclosure-panel-links-777.test.tsx`.

1. Test first: build the CSS with `buildCss`; every rule that styles the panel's links compiles to a selector wrapped
   whole in `:where(…)`; a `ButtonLink` rendered in an open `DisclosureMenu` keeps its own classes and
   `data-variant`. The test fails on master.
2. `PANEL_BASE`: `sft:[&_a]:x` → `sft:[:where(&_a)]:x`, and the same for `:hover` and `:focus-visible`.
3. A comment on `PANEL_BASE` saying why the rules are wrapped.

## Phase 2: docs

Files: `foundation/ui/README.md`, `foundation/ui/CHANGELOG.md`.

1. README, `DisclosureMenu` paragraph: plain links get the panel look; a link with classes of its own
   (`ButtonLink`) keeps them.
2. CHANGELOG `## Unreleased`: the fix and the migration (drop the `[&_a]` resets from `classNames.panel`).

## Decisions (auto)

- `:where()` over `a:not([data-variant])`: covers an app's own classed links too, and needs no marker attribute.
- Patch-level fix (no API change); the coordinator picks the version at release.

## Progress
