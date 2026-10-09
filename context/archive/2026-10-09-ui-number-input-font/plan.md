---
change_id: ui-number-input-font
status: archived
---

# Plan: monospace number inputs (issue #302)

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase plus docs).

## Today (master `e13ae0c`)

- `foundation/ui/src/ui/field.tsx`: `INPUT_CLASS` holds `sft:font-sans` among its frame utilities;
  `NUMBER_INPUT_CLASS = ${INPUT_CLASS} sft:font-mono sft:tabular-nums sft:slashed-zero sft:placeholder:font-sans`.
- Users: `TextField` (`INPUT_CLASS`, or `NUMBER_INPUT_CLASS` with `inputMode`), `PasswordField` (`INPUT_CLASS`),
  `MoneyField` (`NUMBER_INPUT_CLASS`, plus `SUFFIX_PADDING_CLASS` with a suffix), the `Select` trigger
  (`INPUT_CLASS` plus layout utilities, no family).
- Built sheet: `.sft\:font-mono` comes before `.sft\:font-sans`, so on an element with both, sans wins.

## Decisions

1. **One frame, one family per look.** A private `INPUT_FRAME_CLASS` holds every utility of today's `INPUT_CLASS`
   except `sft:font-sans`; `INPUT_CLASS` is the frame plus `sft:font-sans`, `NUMBER_INPUT_CLASS` the frame plus the
   mono utilities. Order inside the class string does not matter to CSS; the rendered set of `INPUT_CLASS` is
   unchanged.

## Phase 1: fix (TDD)

Files: `foundation/ui/src/ui/field.tsx`, `foundation/ui/tests/adoption-gaps-302.test.tsx`.

1. Tests first, red on master: `NUMBER_INPUT_CLASS`, `INPUT_CLASS`, a `MoneyField` with and without a suffix and a
   numeric and a text `TextField` each carry exactly one family utility (`sft:font-sans|mono|serif`, no variant).
2. Implement decision 1.

Done when: the new tests fail on master and pass after; `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build` are green.

## Phase 2: docs and version

Files: `foundation/ui/README.md` (number inputs paragraph), `foundation/ui/CHANGELOG.md` (`## 0.1.15`), version
0.1.15 in `package.json` and `package-lock.json`.

## Progress

- [x] Phase 1: fix (3 new tests red on master, green after)
- [x] Phase 2: docs, version 0.1.15

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; the package's tests pass, the full
`npm test` runs in pre-push.
