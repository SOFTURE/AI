# Plan review: billing-reminder-text-only-428

Verdict: approved (auto).

- Scope matches change.md and the issue's "Expected": `html` optional in what `buildMail` returns, the package's mail
  unchanged, the named test.
- Option 2 avoids a type break on `context.mail.html`; every current template (returning `html: string`) still
  satisfies `Pick<OutgoingMail, "subject" | "text" | "html">` under `exactOptionalPropertyTypes`.
- A template returning `html: ""` is still rejected by mailing's validation; that is mailing's rule and stays
  documented there. No change needed.
- The test fails without the fix (typecheck of the test file is part of `npm run typecheck`); at runtime the old code
  already sends it, which is why the issue's workaround was a cast. Acceptable: the gate is the type.
- Diff stays inside `src/mailing/` of billing, away from #426.
