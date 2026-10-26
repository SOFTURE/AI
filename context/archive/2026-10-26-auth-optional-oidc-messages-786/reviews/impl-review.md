---
change_id: auth-optional-oidc-messages-786
verdict: approved
---

# Implementation review

- Plan conformance: steps 1 to 5 done in a5dc750; README section 9 documents the optional keys.
- Proof: `tests/messages-before-oidc.test.tsx` assigns a 0.2.5-shaped dictionary to `AuthMessages`; with the 0.2.6
  type (`typeof en`) typecheck fails on it (TS2741, checked by reverting the type locally), with the new type it passes.
  The same file checks the English fallback for the four error codes and for `OidcSignIn`, and that the dictionary's
  own copy and generic failure still win.
- Behaviour change: a known code missing from a dictionary at runtime now reads English instead of the generic
  failure. Only reachable for an untyped or older dictionary; strictly more helpful. Accepted.
- Gates: typecheck, lint, language clean; auth tests 464/464.
