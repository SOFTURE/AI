# Plan: core migrations folder on Workers

## Approach

Let `resolveMigrationsDir` return a placeholder `file:` URL when the module URL is undefined on Workers; prove it in
unit tests and in workerd itself.

## Phases

### Phase 1: fix (test-first)

- `foundation/core/tests/module.test.ts`: with `navigator.userAgent` stubbed to `Cloudflare-Workers`, an undefined
  module URL gives `file:///migrations/` that `defineModule` accepts; a real URL still resolves against itself; the
  existing CJS-bundle error stays on Node.
- `foundation/core/src/module.ts`: the Workers branch.
- `examples/next-app/e2e/module-config-on-workerd.spec.ts` + `e2e/fixtures/workerd-module-config/`: `wrangler dev`
  serves a Worker that enables `security` in a cloudflare config at load; the response lists the module and its
  placeholder folder. Skipped outside the Workers suite.
- CHANGELOG `## Unreleased`.
- Done when: the unit tests and the workerd spec fail without the fix and pass with it; typecheck and lint pass.

### Phase 2: version

- `npm run release:version -- core patch` (0.2.10).
- Done when: `foundation/core/package.json` reads 0.2.10 and the CHANGELOG section is `## 0.2.10`.

## Progress

- [x] Phase 1: fix (d451f23)
- [x] Phase 2: version (ebc2869)
