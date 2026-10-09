---
change_id: ui-switch-aria-label
status: archived
---

# Plan: Switch aria-label (issue #339)

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase plus docs).

## Today (master `dfaa508`)

- `foundation/ui/src/ui/switch.tsx`: `SwitchProps extends Omit<SwitchControlProps, "aria-describedby" |
  "aria-label" | "classNames" | "unstyled">`; `Switch` spreads the rest (`...control`) into `SwitchControl`, which
  spreads its `aria-*` props onto the input.

## Phase 1: fix (TDD)

Files: `foundation/ui/src/ui/switch.tsx`, `foundation/ui/tests/adoption-gaps-339.test.tsx`.

1. Test first: a `SwitchProps` object literal with `label` and `"aria-label"` renders the name on the
   `role="switch"` input, the visible label stays tied by `for`; no prop, no attribute; `aria-describedby` from
   `description` stays next to it. Red on master through `npm run typecheck` (TS2353), since the runtime already
   passes the prop.
2. Drop `"aria-label"` from the `Omit`; document on `label` and `aria-label` that it overrides the visible label.

## Phase 2: docs and version

`foundation/ui/README.md` (Switch example), `foundation/ui/CHANGELOG.md` (`## 0.1.16`), version 0.1.16 in
`package.json` and `package-lock.json`.

## Progress

- [x] Phase 1: fix (typecheck red on master with the new test, green after)
- [x] Phase 2: docs, version 0.1.16

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; the package's tests pass, the full
`npm test` runs in pre-push.
