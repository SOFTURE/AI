# Plan review: ui-card-panel-footer-gaps

Reviewed: `plan.md` against `change.md`, issue #218 and the current sources of `card.tsx`, `copy-hint.tsx`,
`field.tsx`, `form-fields.tsx`, `modal.tsx`, `action-form.tsx` and `hint.tsx`. Verdict: **approved with fixes
applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | The first draft added `hintProps` to `Field` only. Apps use `TextField` / `NumberField` / `SelectField`, which build `Field` from `BaseFieldProps`, so the option would be unreachable in practice. | Fixed in the plan: `BaseFieldProps.hintProps` passed through to `Field` (D1, Phase 1 test on `TextField`). |
| F2 | Warning | The first draft added the `cancel` slot to `ModalFooter` only. `StandingPanel` is documented with an `ActionForm onCancel`, which renders its own footer; the slot would not reach Cancel there. | Fixed in the plan: `ActionFormSlot.cancel` forwarded (D3, Phase 1 test). |
| F3 | Suggestion | `hintProps` could also accept `unstyled` or `glyph`. | Not added: the issue asks for look and spacing; `unstyled` already comes from the card itself, and a different glyph per card is not a reported need. The `Pick` keeps the door open. |
| F4 | Suggestion | `headingLevel` could allow 4 like `Card`. | Kept 1–3 as the issue proposes: a dialog title deeper than `h3` has no use, and a narrow union documents intent. |
| F5 | Suggestion | A server `Card` passes `hintProps` to the client `CopyHint`; a function in it would break the RSC boundary. | `HintAppearance` holds only strings and numbers (slot classes, px, boolean), so it is serializable by construction; no plan change. |

No migration, no cross-package contract. Release: ui 0.1.11 by whichever ui change merges second (see change.md).
