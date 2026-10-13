---
change_id: billing-access-badge-copy-426
title: "billing: AccessBadge texts per kind, a short form, an accessible prefix and the tone on the root (issue #426)"
status: implementing
roadmap_item: null
issue: 426
branch: claude/project-thread-1sxkac
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #426](https://github.com/SOFTURE/AI/issues/426) (labels `enhancement`, `pkg: billing`, `adoption`): an
adopting app with its own access badge cannot switch to `AccessBadge` / `CurrentAccessBadge` without changing what
its users see. The badge gains:

1. A text override per kind, receiving the entitlement, the days left and the default text.
2. An optional short form, always or below the `sm` breakpoint.
3. An accessible prefix read before the label ("Access status: …").
4. `data-tone` (and `data-kind`) on the root for end-to-end tests and app styles.
5. A tone scope that colours the whole pill, not only the status text.

## Context

billing is at 0.2.1 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. Issue #428 also changes billing in a parallel thread; this change stays inside the badge
(`src/ui/access-badge.tsx`, `src/next/access.tsx`, its tests, README and CHANGELOG).

## Constraints

- Additive: the default rendering (DOM, text, classes) of every existing call stays exactly as it is.
- Server-safe: the badge still renders from props, no client hooks.
- No inline copy in `src/ui/`: the new texts come from the app (props), not literals.

## Notes

- Framing: skipped. The issue names the gaps and the expected API.

## Decisions (auto)

- Text override as `texts: Partial<Record<AccessBadgeKind, (input) => AccessBadgeText>>` rather than one render prop:
  the app overrides only the kinds it words differently, and every kind keeps its default otherwise.
- The short form is a text (`short`) plus `variant: "full" | "short" | "responsive"`; responsive swaps at `sm`, the
  breakpoint billing already uses. The default short text is the status alone.
- The accessible prefix is a prop (`srPrefix`), not a message: the default badge stays as it is, and the words are
  the app's.
- Whole-pill tone is `toneScope: "status" | "pill"`; `data-tone` is the class hook for anything else.
