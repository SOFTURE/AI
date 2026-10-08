---
change_id: ui-action-form-submit-slot
title: "ui: ActionForm submit slot (issue #230)"
status: archived
roadmap_item: null
issue: 230
branch: claude/project-thread-eigpzo
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Give `ActionForm` of `@softure-ai/ui` a `submit` slot, added to the submit `Button`'s classes in both the page
branch and the modal branch (`onCancel`), so that an adopting app that styles its buttons through `className`
can give the form's submit button the same look without child or descendant selectors
([#230](https://github.com/SOFTURE/AI/issues/230)).

A reviewer checks the new test in `foundation/ui/tests/`, the README line, the CHANGELOG and the version bump
(ui 0.1.12).

## Context

- `ActionFormSlot` is `"root" | "actions" | "cancel"`. The page branch renders the submit `Button` inside the
  `actions` slot; the modal branch renders it as a child of `ModalFooter`, which gets only `classNames.cancel`.
  Nothing from the app reaches the submit button in either branch.
- `Button` already takes `className`, added after `classNames.root` (0.1.9); `cancel` (0.1.11) set the precedent of
  a slot that lands on a button's `className`.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: the slot is optional, its default is empty, so markup without it is unchanged.
- Only `@softure-ai/ui` changes. Bumps it 0.1.11 → 0.1.12; the thread releases it after the merge (no other open
  change touches ui).

## Process notes

- Research: skipped as a separate artefact. The issue names the one file (`foundation/ui/src/ui/action-form.tsx`)
  and the reading needed fits in `plan.md` § Findings.
- Framing: skipped. The issue reports a concrete missing option with its visible effect and proposes the same
  mechanism the package already uses for `cancel`; there is no competing explanation to weigh.
