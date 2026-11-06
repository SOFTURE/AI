# Plan: dependabot-1108

## Phases

1. Manifests: Tailwind 4.3.4 and hyperframes 0.9.6 from #1108; rebuild the hyperframes lock entries so it hoists once.
2. Code: `HYPERFRAMES_VERSION` follows; fix any test that pins Tailwind's selector serialization.
3. Gates: typecheck, ESLint, language gate, the marketing-kit and theme tests, theme-notion coverage, then CI.
4. After the merge: close #1108 with a pointer to the merged pull request.

## Decisions (auto)

- Hold satori, typescript-eslint and forwarded-parse for the reasons in change.md; no Dependabot ignore rules (the
  owner decides those).

## Progress

- [x] p1 manifests and lockfile (undici 7.30.2 everywhere, audit 0)
- [x] p2 `HYPERFRAMES_VERSION` 0.9.6; theme-notion tab order test matches the class inside Tailwind 4.3.4's `:is(...)`
- [x] p3 typecheck, lint, language green; `vitest run tools/marketing-kit themes` and theme-notion coverage green
- [ ] p4 close #1108 after the merge
