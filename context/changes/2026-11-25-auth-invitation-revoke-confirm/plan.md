# Plan: auth-invitation-revoke-confirm

## Approach
A `RevokeAction` row control in `invitation-panel.tsx` wraps the existing row form: its submit button's click is
prevented and opens a `Modal`; the dialog's Revoke calls `requestSubmit()` on that form and closes. Test first.

## Phases
### Phase 1: confirm before revoke (TDD)
- `modules/auth/tests/invitation-panel.test.tsx` first (red): clicking Revoke shows a dialog named after the email and
  does not call the action; Cancel closes it, the action is not called and focus is back on Revoke; confirming calls
  the revoke action once with the row's id; Resend still submits at once; a row without `email` gets the unnamed
  title.
- `src/messages/en.ts` (new keys), `src/messages/index.ts` (keys optional, merged over English),
  `src/ui/invitation-panel.tsx` (`email` on the row, `RevokeAction`, `modalClassNames`, 44 px phone height),
  `src/next/pages.tsx` (`email` in `toInvitationRow`), README (Invitations), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run modules/auth` passes, typecheck and lint pass.

## Progress
- [x] Phase 1: confirm before revoke (the five dialog tests red before the change, Resend green; after:
  `npx vitest run modules/auth` 43 files, 565 tests passed; typecheck and ESLint passed; the 44 px class is
  `sft:min-h-11 sft:md:min-h-0`, which ui compiles, after auth's architecture test rejected `max-sm:h-11`) PHASE1_SHA
