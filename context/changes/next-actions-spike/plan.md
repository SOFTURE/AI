# Plan: next-actions-spike

Input: change.md, research.md

## Goal

A documented verdict on package-shipped Next code, backed by a spike package and an e2e check in
the example app, and a migrations-folder form that builds under Turbopack.

## Approach

Keep the spike as a private workspace package mounted in the example app, so the e2e guards the
verdict until a real module (auth, ID-3) replaces it. Add `resolveMigrationsDir` to core instead of
changing `ModuleMigrations.dir` to a string: no contract break, and the URL stays absolute.
Rejected: `dir: string` (relative to what is ambiguous once bundled); `serverExternalPackages` for
every module (pushes a bundler detail onto each app); app-side action wrappers (not needed).

## Phase 1: Migrations folder that builds

**Discipline:** TDD. **Files:** `foundation/core/src/module.ts`, `src/index.ts`,
`tests/module.test.ts`, `README.md`, `docs/02-module-standard.md` §4,
`examples/next-app/modules/guestbook/index.ts`, `context/backlog/next-integration.md`.

1. Tests for `resolveMigrationsDir(moduleUrl, relativePath)`: string and URL input, accepted by
   `defineModule`, relative module URL throws.
2. Implement and export it; docs show it; the guestbook drops the `String(import.meta.url)` workaround.
3. Close the backlog entry with the resolution.

Done when: core tests pass; `next build` of the example passes with the guestbook on the helper.

## Phase 2: Spike package and e2e

**Discipline:** test-after (the measurements came first). **Files:** `spikes/next-actions/**`,
root `package.json`, `examples/next-app/{package.json,package-lock.json,softure.config.ts,.gitignore}`,
`examples/next-app/app/spike/next-actions/page.tsx`, `app/api/spike/next-actions/route.ts`,
`e2e/next-actions.spec.ts`, `e2e/migrations.spec.ts`.

1. Package from `templates/package/`: `"use server"` action with a bound tag, client form with
   `useActionState`, server component page, GET/POST route handlers, pl/en messages, one migration
   declared through the helper.
2. Mount it with one-line re-exports and one `softure.config.ts` entry.
3. e2e: action via a client form, the same form without JavaScript, route handlers, a foreign-origin
   action POST refused; the migrations ledger lists the package's migration.

Done when: `npm run e2e` passes locally and in the `e2e` workflow.

## Phase 3: Verdict in the standard

**Discipline:** docs. **Files:** `docs/02-module-standard.md` §8, `foundation/core/README.md` §4,
`foundation/core/src/next/registry.ts`, `spikes/next-actions/README.md`.

Write the verdict and the rules measured in research (mounting, config, bound arguments, encryption
key, origins, packaging, workspace links); mark the registry as confirmed.

Done when: links and language gates pass; §8 cites the spike and the e2e file.

## Risks and rollback

Additive only. Rollback: revert the merge; the guestbook goes back to the `String()` workaround.

## Decisions (auto)

- The spike stays in the repository as the e2e fixture instead of being deleted. → The roadmap asks
  for an e2e check; the fixture is removed when auth covers the same paths.
- `allowedOrigins` and the encryption key are app settings, not module settings. → Next applies them
  per app; modules only document them.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Migrations folder that builds

#### Automated
- [ ] 1.1 `resolveMigrationsDir` tests pass (string, URL, defineModule, relative URL throws)
- [ ] 1.2 Example `next build` passes with the guestbook on the helper
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: Spike package and e2e

#### Automated
- [ ] 2.1 `next build` lists the package's page and API route; the package migration applies
- [ ] 2.2 `npm run e2e` green locally (10 tests)
- [ ] 2.3 `e2e` workflow green on the pull request

### Phase 3: Verdict in the standard

#### Automated
- [ ] 3.1 docs/02 §8 holds the verdict and cites the spike and the e2e file
- [ ] 3.2 Gates green (typecheck, lint, test)
