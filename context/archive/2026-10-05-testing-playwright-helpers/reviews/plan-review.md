# Plan review: testing-playwright-helpers

Date: 2026-10-05 · Verdict: approved

- The split of FIRE's folder is argued file by file; the non-generic files (environment, raw `pg`,
  FIRE screens, `snapshot-form`) stay out, as the roadmap asks.
- The roadmap's unknown is decided with a reason that holds: a foundation package depending on every
  module would invert the layering; the auth factory goes to the gap list instead of widening the item.
- A structural `AuthFormCopy` keeps the package module-free and still drives the forms with auth's
  own labels, so a copy change in auth cannot leave the helpers silently stale.
- Browser tests follow the marketing-kit pattern, so CI runs them on the runner's Chrome.
- Risk: moving 20+ specs can break the e2e in ways unit tests do not see; the plan requires the full
  local e2e run before the merge. Keep each spec edit mechanical.
- Watch: `expect` from `@playwright/test` outside the runner must be proven in a test, not assumed.
