---
change_id: billing-access-badge-copy-426
status: implementing
---

# Plan: billing-access-badge-copy-426

Input: change.md, research.md. Complexity: small (one component, its server wrapper, docs). Tests are written first
in `modules/billing/tests/access.test.tsx`.

## Phase 1: badge options

Files: `src/ui/access-badge.tsx`, `src/ui/index.ts`, `src/next/access.tsx`, `tests/access.test.tsx`.

1. Types: `AccessBadgeText { status; detail?; short? }`, `AccessBadgeTextInput { kind, entitlement, daysLeft: number |
   null, endsAt: Date | null, text }` (`text` is the default), `AccessBadgeTextFormatter`, `AccessBadgeVariant`
   (`full` | `short` | `responsive`), `AccessToneScope` (`status` | `pill`). Exported from `/ui`.
2. `texts` replaces the default text of the kinds it names; the formatter's result is used as is.
3. `variant`: `full` (default) renders as today; `short` renders one `short` slot with `text.short ?? text.status`;
   `responsive` renders the full parts inside a `full` slot hidden below `md` and the `short` slot hidden from `md` (classes ui compiles).
4. `srPrefix`: a `prefix` slot (default `sft:sr-only`) with the prefix and a space, first in the root.
5. Root gets `data-kind` and `data-tone`; `toneScope="pill"` puts the tone's text colour on the root; status and detail
   inherit it.
6. `CurrentAccessBadge` takes and passes `texts`, `variant`, `srPrefix`, `toneScope`.

Tests: per-kind override (with days left), defaults kept for other kinds, short and responsive structure,
the prefix, `data-tone`/`data-kind` per kind and with `tones`, pill classes, unchanged default DOM.

## Phase 2: docs

README §4 options paragraph and §8 Appearance; CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: badge options (`7df59b1`; 14 tests, written first; breakpoint `md` and pill text tone: classes ui compiles)
- [x] Phase 2: docs (README §4 and §8, CHANGELOG Unreleased)
