# Plan: mcp-access-revoke-confirmation

## Approach
Replace the Revoke and Disconnect forms in `TokenItem` and `GrantItem` with a confirmation control, test first: by
default a danger trigger opening a `Modal` (width `confirmation`) of `@softure-ai/ui`, or the app's `confirmButton`.
`createConfirmRun` calls the `(previous, formData) => FormState` action with the row's id and maps an error code to
`getTokenErrorMessage` (a rejection to the generic error).

## Phases
### Phase 1: confirmation dialogs (TDD)
- `tests/token-manager.test.tsx` first (red): Revoke opens a dialog titled with the token's name; Cancel closes it
  without calling `revokeAction` and focus is back on the trigger; confirm calls it with the row's id; an error
  stays in the dialog with the module's copy. The same for Disconnect.
- `src/messages/en.ts`: `list.confirmTitle` ("Revoke {name}?"), `list.confirmText`, `grants.confirmTitle`,
  `grants.confirmText`; `src/ui/token-manager.tsx` (trigger keeps its accessible name `Revoke: <name>`), the
  `confirmButton` prop and its exported types, README and CHANGELOG `Unreleased`.
- `examples/next-app/e2e/mcp-access.spec.ts` and `mcp-oauth.spec.ts`: click the trigger, then confirm in the dialog.
- Done when: `npx vitest run modules/mcp-access` passes; typecheck and lint pass; the e2e specs updated (run in CI).

## Progress
- [x] Phase 1: confirmation dialogs (the six new or changed dialog tests red on the old component; after:
  `npx vitest run modules/mcp-access` 568 passed; typecheck and ESLint passed; e2e specs confirm in the dialog, run in
  CI) 718d73dd
