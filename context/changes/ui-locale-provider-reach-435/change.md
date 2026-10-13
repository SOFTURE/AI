---
change_id: ui-locale-provider-reach-435
title: "ui locale: client components outside ui follow UiLocaleProvider (issue #435)"
status: planned
roadmap_item: null
issue: 435
branch: claude/project-thread-02co4p
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #435](https://github.com/SOFTURE/AI/issues/435) (labels `enhancement`, `pkg: ui`, `adoption`): an app
that wraps its layout in `<UiLocaleProvider locale="pl">` gets Polish built-in copy from every `"use client"` component
outside `@softure-ai/ui` that takes `locale`, without repeating the prop at each call site. Resolution order everywhere:
explicit prop, then the provider, then `en`. Each affected package README says that client components follow the
provider and server components keep the prop.

## Context

Issue lists `@softure-ai/charts` (`ChartCursor`, cursor readouts), `@softure-ai/billing` (`PaymentForm`, `TrialForm`,
`GrantForm`, `GrantHistory`, `PaymentRequests`), `@softure-ai/privacy` (`DeleteAccountForm`) and
`@softure-ai/feature-switches` (switch panel). Versions on master: ui 0.2.0, charts 0.1.9, billing 0.2.1. Releases are
batched by the coordinator: no version bump, CHANGELOG `## Unreleased`.

## Constraints

- Threads for #426 and #428 change `modules/billing` in parallel; this change keeps its billing edits to the README
  and CHANGELOG so a merge stays trivial. This change merges after them.
- No change to `@softure-ai/ui` itself.

## Notes

- Placement: unlinked (`roadmap_item: null`), issue mode.
- Framing: skipped. The issue states the gap and the resolution order.

## Decisions (auto)

- See research.md: only charts has its own copy; the module forms forward `locale` to ui fields that already resolve
  the provider when the prop is `undefined`. Code changes go to charts only; the modules get the README line and a
  test where provider-driven copy is visible.
- No version bump; `## Unreleased` in each touched CHANGELOG.
