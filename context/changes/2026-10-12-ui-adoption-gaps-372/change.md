---
change_id: ui-adoption-gaps-372
title: "ui: four gaps in the interaction components (issue #372)"
status: open
roadmap_item: null
issue: 372
branch: claude/project-thread-77cx0m
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #372](https://github.com/SOFTURE/AI/issues/372) (labels `enhancement`, `pkg: ui`, `adoption`): four gaps
an adopting app hit with the #319 interaction components, which keep it on its own code.

1. `ConfirmActionButton` takes `modalClassNames` (the dialog's `Modal` slots) and a `cancel` slot for the footer's
   Cancel button.
2. `useDisclosure` (and `DisclosureMenu`) take `closeOutsideOn: "pointerdown" | "click"`, `pointerdown` by default,
   so a panel in the document flow does not collapse under the finger before the click lands.
3. A server-safe external link: `getExternalRel` moves to a module without `"use client"`, next to a
   `ServerExternalLink` that takes its locale and copy by props and uses no hook.
4. `useDismissed` takes `{ initial: "dismissed" | "shown" }` (`dismissed` by default) for the state before
   hydration; the README says how to migrate a value stored in another format (an ISO timestamp).

A reviewer checks `foundation/ui/tests/adoption-gaps-372.test.tsx`, the README and the CHANGELOG `Unreleased` entry.

## Context

ui is at 0.1.16 on master. Releases are batched by the coordinator, so this change bumps no version: the CHANGELOG
gets an `## Unreleased` section.

## Constraints

- Every default stays as it is: no behaviour change for an app that passes none of the new options.
- `ExternalLink` keeps its API and output; it now renders through `ServerExternalLink`.

## Process notes

- Framing: skipped. The issue states each gap with its cause and the ask.

## Decisions (auto)

- No version bump; `## Unreleased` in the CHANGELOG (batched releases).
- Item 3: a new `ServerExternalLink` component plus `getExternalRel` in a server-safe module, rather than turning
  `ExternalLink` into a server component (that would lose the provider's locale for existing callers).
- Item 4: the migration is documented, not coded: a value that is not `YYYY-MM-DD` already counts as not dismissed,
  and an app rewrites its old value once with `getDismissalDate(new Date(old))`.
