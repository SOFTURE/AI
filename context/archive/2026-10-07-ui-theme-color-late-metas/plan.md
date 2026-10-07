# Plan: ui-theme-color-late-metas

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one function).

## Goal

After the first load with an explicit choice, every `theme-color` meta matches it, however late Next inserts it.

**Out of scope:** metas whose `content` attribute React rewrites in place (no insertion), the "system" path, the
switch itself.

## Findings

- `getThemeBootScript` registers one `DOMContentLoaded` listener that sets `content` on the metas found then.
- Metas that arrive later come from client JavaScript (Next's async scripts, React 19 hoisting `<meta>` to `<head>`),
  which can run after `DOMContentLoaded` and, in development, after `load`. So the issue's "disconnect on `load`"
  would still miss some.
- `applyThemeChoice` sets or removes `data-theme`; the attribute is the live source of truth for the choice.

## Key decisions

- **D1** a `MutationObserver` on `<html>` (`childList`, `subtree`) that, when an added element is or contains a
  `theme-color` meta, recolours all of them. It lives as long as the page, because hoisting can happen after `load`
  and on client navigation. Cost: one `matches` / `querySelector` per added element; no work for other mutations.
- **D2** the colour follows the current `data-theme` at the moment of the mutation, not the cookie read at boot,
  so a later switch (to the other scheme or to System, attribute removed) is respected: on System the observer does
  nothing and Next's own per-media colours stay.
- **D3** writes only when `content` differs; attribute writes do not trigger `childList` records, so no loop.
- **D4** guarded by `typeof MutationObserver === "function"`; the `DOMContentLoaded` pass stays.

## Phase 1: late metas (TDD)

- Tests (happy-dom, a fresh `Window` per test, script compiled with that window's `document` and
  `MutationObserver`): a meta inserted after `DOMContentLoaded` gets the choice; a meta inside a wrapper in `<body>`
  too; after switching to dark a new meta gets dark; after switching to System a new meta keeps its own colour;
  no cookie leaves everything alone. The existing fake-document tests get `getAttribute` on `<html>` and on metas.
- Code: `foundation/ui/src/theme/theme-cookie.ts`; README line; CHANGELOG `## Unreleased`.

Done when: the first three tests were seen red on the old script, all green with the fix; typecheck, lint, test,
build green.

## Progress

- [x] Phase 1: late metas
