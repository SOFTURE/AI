---
change_id: auth-optional-oidc-messages-786
---

# Research

## R1: the type

`modules/auth/src/messages/index.ts`: `export type AuthMessages = typeof en`. 0.2.6 added `oidc.signInWith`,
`oidc.divider` and `errors.auth.oidc_failed | oidc_cancelled | oidc_not_allowed | oidc_no_account` to `en`, so every
`const x: AuthMessages = {...}` without them stops compiling.

## R2: where the keys are read

- `src/ui/oidc-sign-in.tsx`: `messages.oidc.signInWith`, `messages.oidc.divider`.
- `getAuthErrorMessage` (`src/messages/index.ts`), used by the forms and by `LoginPage` for `?oidc_error=`: looks the
  code up in `messages.errors`, else `core.unexpected`. A missing oidc key would show the generic failure.
- No other reader (`grep oidc src/ui src/next src/mailing`).

## R3: how dictionaries reach the components

`auth({ messages })` deep-merges overrides over `en` (`mergeMessages`, `foundation/core/src/i18n.ts`), so a
dictionary passed through the factory already gets English for missing keys at runtime. A dictionary passed straight
to a component (`<OidcSignIn messages={pl} />`, `<LoginForm messages={pl} />`) is not merged; that path needs the
fallback in the reader.
