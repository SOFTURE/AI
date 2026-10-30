---
change_id: mcp-access-write-switch-consent-host-904-906
verdict: approved
---

# Implementation review

Reviewed the branch against plan.md and issues #904 and #906.

- #904: `WRITES_ENABLED_SWITCH` sits in the manifest and `module.json`. `isWritingEnabled(ctx)` skips the read
  without `allowWrites`, treats `undeclared` as on and a thrown read as off, logging only the switch name. The
  endpoint reads it once per request, for the challenge's scopes and the verified token's scopes (so the factory
  gets `canWrite: false` and serves no write tools). `validateAuthorizationRequest` uses it for the default scope
  and the new `isWriteOffered`. The decision route and the consent page both use `isWriteOffered`, so a stale form
  that posts `canWrite` while the switch is off is granted read only. The stdio entry reads it at start.
  `tests/writes-switch-904.test.ts` covers every point, including the decision row in `oauth_authorization_codes`.
- #906: `ConsentForm` shows the target in its own `dt`/`dd` row with the `target` slot (monospace, foreground),
  then the hint in `note`. The app row holds the client name alone. `consent.returnsTo` is replaced by
  `redirectLabel` and `redirectHint`. `OAuthConsentPage` passes `classNames` and `unstyled` to the form and the
  error. Tests cover an https host, a native-scheme URI and a restyled `target`.
- Compatibility: `isWriteRequested` is kept; apps without the switch behave as before (existing endpoint and OAuth
  tests pass unchanged). The changelog explains the removed message key.
- Gates: typecheck (whole tree), ESLint on the package (zero warnings), the language gate, and vitest for
  mcp-access, feature-switches and `tests/repo` all pass.

Verdict: approved.
