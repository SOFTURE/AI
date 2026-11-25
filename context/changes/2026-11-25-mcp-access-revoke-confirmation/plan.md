# Plan: mcp-access-revoke-confirmation

## Approach
Replace the Revoke and Disconnect forms in `TokenItem` and `GrantItem` with `ConfirmActionButton` from
`@softure-ai/ui`, test first. A small adapter turns a `(previous, formData) => FormState` action into
`(formData) => ConfirmActionResult`, mapping an error code to `getTokenErrorMessage`.

## Phases
### Phase 1: confirmation dialogs (TDD)
- `tests/token-manager.test.tsx` first (red): Revoke opens a dialog titled with the token's name; Cancel closes it
  without calling `revokeAction` and focus is back on the trigger; confirm calls it with the row's id; an error
  stays in the dialog with the module's copy. The same for Disconnect.
- `src/messages/en.ts`: `list.confirmTitle` ("Revoke {name}?"), `list.confirmText`, `grants.confirmTitle`,
  `grants.confirmText`; `src/ui/token-manager.tsx` uses `ConfirmActionButton` (trigger keeps its accessible name
  `Revoke: <name>`), README and CHANGELOG `Unreleased`.
- `examples/next-app/e2e/mcp-access.spec.ts` and `mcp-oauth.spec.ts`: click the trigger, then confirm in the dialog.
- Done when: `npx vitest run modules/mcp-access` passes; typecheck and lint pass; the e2e specs updated (run in CI).

## Progress
