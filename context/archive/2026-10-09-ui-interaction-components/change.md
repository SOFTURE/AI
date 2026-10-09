---
change_id: ui-interaction-components
title: "ui: disclosure menu, ConfirmActionButton, ModalTrigger, CopyButton, ExternalLink, useDismissed; SegmentedControl non-colour cue (issue #319)"
status: archived
roadmap_item: null
issue: 319
branch: claude/project-thread-x2bvuf
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #319](https://github.com/SOFTURE/AI/issues/319): an adopting app still owns about 500 lines of generic
interaction components built on `Modal`, `IconButton`, `ActionForm` and `announceToast`. They move into
`@softure-ai/ui`:

1. `useDisclosure` + `DisclosureMenu` (APG disclosure navigation).
2. `ConfirmActionButton`: a destructive action behind a confirmation modal that states the stakes.
3. `ActionFormModal` + `ModalTrigger`: an `ActionForm` in a `Modal`, opened by a "+" `IconButton`.
4. `CopyButton`: copied and failed states, a manual-select fallback without a secure context.
5. `ExternalLink`: new tab, `noopener`, a screen-reader note.
6. `useDismissed(key, days)`: dismiss-for-N-days storage for banners.

Also: the checked `SegmentedControl` segment (and `SEGMENT_ACTIVE_CLASS`) gets a non-colour cue, so a light accent
no longer fails WCAG 1.4.11.

A reviewer checks `foundation/ui/tests/adoption-gaps-319.test.tsx`, the README sections and the CHANGELOG entry.

## Context

Issue #319, filed by an adopting app. Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue.
`@softure-ai/ui` 0.1.15 (#302, #303) was published while this change was in flight, so it ships as 0.1.16, a
version shared with #320 (whichever merges second folds into the same section).

## Constraints

- The package never imports a framework: route changes reach `useDisclosure` as a `closeKey` the app passes
  (its pathname).
- Copy lives in `src/messages/` (architecture test); the new strings get `en` and `pl`.
- Colours only from tokens.

## Process notes

- Research: skipped as a separate file. The issue specifies each behaviour; reading `modal.tsx`, `action-form.tsx`,
  `button.tsx`, `toast.tsx` and `segment-classes.ts` answered the unknowns; findings are in plan.md's "Today".
- Framing: skipped. The problem (duplicated generic components) and the wanted API are stated in the issue.
