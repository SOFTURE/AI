---
change_id: ui-app-components-407
title: "ui: app shell, required consent, stepper, checklist and the other generic components (issue #407)"
status: archived
roadmap_item: null
issue: 407
branch: claude/project-thread-erxzvr
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #407](https://github.com/SOFTURE/AI/issues/407) (labels `enhancement`, `pkg: ui`, `adoption`): after
adopting ui 0.1.16 an app still owns generic components every signed-in app needs. `@softure-ai/ui` gains them:

1. App shell: `AppHeaderBar` (sticky), `AccountMenu` and `MobileMenu` on top of `useDisclosure`, copy from messages.
2. `CheckboxField` `required` + `requiredMessage`: validated on the native `invalid` event, message shown, focus moved.
3. `Stepper`: named steps with icons, the current step, back-only navigation.
4. `Checklist`: an onboarding list of `{ label, done, href }`.
5. `ColorField` (hex input with a swatch) and `SuggestedAmountField` (a money field with a "use suggested value" chip).
6. `DeferredRender`: a Suspense streaming helper.
7. A query-parameter segmented nav in a new `@softure-ai/ui/next` subpath: items keep the current query string and
   use `Link` with `scroll={false}`.
8. A `Modal` motion option: enter and leave animation, with hooks for an app's own keyframes.
9. The `ink` button variant: already shipped (`ink`, `ink-outline` in `Button`); nothing to add.
10. README: mounting `UiLocaleProvider` once removes the per-call `locale`/`messages` props.
11. The issue comment: `ConfirmActionButton` class hooks (shipped in 0.1.17, #372) and a form action with hidden
    fields instead of a click callback.

## Context

ui is at 0.1.17 on master with an `## Unreleased` section (#403 guards). Releases are batched by the coordinator: no
version bump, the CHANGELOG gets `## Unreleased`. The package runs the #403 guards on its own components
(`tests/architecture.test.ts`), so the new components must pass them (tokens only, no inline copy, no native
tooltip, nothing that opens on hover only).

## Constraints

- Additive: no breaking change to existing props or behaviour (Modal's default motion stays as it is).
- `src/ui/` stays framework-free (ESLint NFR-3); only `src/next/` imports Next.js, by bare specifiers (L-002).
- Every visible and ARIA text comes from props or `uiMessages` (`en`, `pl`).

## Process notes

- Framing: skipped. The issue lists the components and their behaviour.

## Decisions (auto)

- Item 9 needs no code: `Button` has had `ink` and `ink-outline` since an earlier release (README Primitives table).
- Item 11, first ask: done in 0.1.17 (`modalClassNames`, `cancel` slot); only the form action is new.
- `next` becomes an optional peer dependency of ui, needed only by `@softure-ai/ui/next`.
