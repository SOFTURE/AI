# Plan review: auth-testing-account-factory

Date: 2026-10-06 · Verdict: approved

- The roadmap's unknown is answered with the module's own convention: `Queryable`, as every function of
  `@softure-ai/auth/server` takes; the caller keeps the pool (`withDatabase`).
- The hash parameters come from the app's config in the example, so the first login cannot rehash
  behind the test's back; the default equals auth's default for apps that set none.
- Throwing on a bad email or a taken email fits the repository's rule (exceptions are for bugs): in test
  setup both are bugs of the test. The tests must prove nothing is written in those cases, roles included.
- The e2e split is argued per spec: what registration records (consent, sign-up attribution, funnel)
  keeps the form; everything else is setup. The taken-email test keeps its form submission and only
  gets its existing account from the factory.
- A patch rather than 0.2.0 is forced by the dependents' `^0.1.0` ranges; the entry is additive.
- Risk: converting about 15 specs can break the e2e in ways unit tests do not see; the plan requires the
  full local e2e run before the merge. Keep each edit mechanical: same pages, same assertions.
- Watch: `src/testing/` must not be imported by runtime code, and the published `files` must ship it
  (it is under `src/` and `dist/`, so it is).
