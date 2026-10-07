# Plan: ui-card-panel-footer-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases, one package).

## Goal

Every point of issue #218 lands in `@softure-ai/ui` as an optional, backward-compatible prop or slot, with tests,
README and CHANGELOG lines and ui 0.1.11.

**Out of scope:** `Switch`'s own hint (not in the issue), the submit button of `ActionForm`, the adopting app's
migration.

## Findings (the reading behind the plan)

- `copy-hint.tsx`: `CopyHint` is the client wrapper that formats the package's `hintLabel` and renders
  `<Hint label id anchorLeft>`. `Card` (server-safe) and `Field` are its only callers.
- `hint.tsx`: `HintProps` already has `classNames: ClassNames<HintSlot>`, `triggerGap` (px, default 6),
  `isWide`, `unstyled`. All are serializable, so a server `Card` can pass them to the client `CopyHint`.
- `form-fields.tsx`: `TextField`, `NumberField`, `SelectField`… build `Field` from `BaseFieldProps`; without a
  pass-through there, the `Field` option would be unreachable from the components apps actually use.
- `modal.tsx`: `Modal` and `StandingPanel` both hard-code `<h2 id={titleId}>`; `ModalFooter` renders Cancel as
  `<Button variant="secondary" … unstyled>`. `Button` takes `className` (added in 0.1.9), appended after
  `classNames.root`.
- `action-form.tsx`: with `onCancel`, `ActionForm` renders its own `ModalFooter`; its slots are `root` and `actions`
  only, so the documented `StandingPanel` + `ActionForm` pairing could not reach the new Cancel slot either.

## Key decisions

- **D1 (point 1)** a shared type `HintAppearance = Pick<HintProps, "classNames" | "triggerGap" | "isWide">`
  exported from `hint.tsx`. `CopyHint` takes `appearance?: HintAppearance` and spreads it on `Hint`
  (`label`, `id`, `anchorLeft` stay its own). `Card`, `Field` and `BaseFieldProps` take `hintProps?:
  HintAppearance` (the issue's name) and pass it on. One prop rather than a `hintClassNames` + `hintTriggerGap`
  pair: a single object an app defines once and reuses for every hint.
- **D2 (point 2)** `headingLevel?: 1 | 2 | 3` (type `ModalHeadingLevel`) on `Modal` and `StandingPanel`, default 2;
  the look stays the slot's (as `Card.headingLevel` does). The caller decides the level, e.g. `isOpen ? 1 : 2`.
- **D3 (point 3)** `ModalFooterSlot` gains `cancel`, passed to the Cancel `Button` as `className` (so it adds to the
  button look and still works with `unstyled`). `ActionFormSlot` gains `cancel`, forwarded to its `ModalFooter`.

## Phase 1: behaviour (TDD)

- Tests: `Card hintProps` puts trigger and bubble classes on the hint and `triggerGap` reaches the placement (bubble
  top differs by the gap, mocked rects); default card hint keeps today's markup; `Field` / `TextField` `hintProps`
  reach the tooltip hint; `StandingPanel headingLevel={1}` renders `<h1>` with the title id, default `<h2>`;
  `Modal headingLevel={3}` renders `<h3>`; `ModalFooter classNames.cancel` lands on Cancel, not on the submit;
  `ActionForm classNames.cancel` with `onCancel` lands on Cancel.
- Code: `ui/hint.tsx`, `ui/copy-hint.tsx`, `ui/card.tsx`, `ui/field.tsx`, `ui/form-fields.tsx`, `ui/modal.tsx`,
  `ui/action-form.tsx`.

Done when: the new tests were seen red, then green; gates green.

## Phase 2: docs and version

- README (Card `hintProps`, Field `hintProps`, `headingLevel` on dialogs, `cancel` slot), CHANGELOG 0.1.11,
  version 0.1.11 and the lockfile.

Done when: gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: behaviour

#### Automated
- [x] 1.1 Card, Field, dialog heading and Cancel tests seen red, then green — 33508d4
- [x] 1.2 Gates green (typecheck, lint, test) — 33508d4

### Phase 2: docs and version

#### Automated
- [x] 2.1 README, CHANGELOG, version 0.1.11 and lockfile — 067a5ae
- [x] 2.2 Gates green (typecheck, lint, test, build) — 067a5ae
