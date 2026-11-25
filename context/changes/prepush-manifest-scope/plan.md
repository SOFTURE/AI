# Plan: prepush-manifest-scope

## Approach
`scripts/test-changed.mjs` gets `getPushTestScope({ files, root, readBaseLockfile })`: no full-suite file → related
tests (unchanged); a full-suite file → `getTestScope` of the CI with the lockfile reach computed from the base lockfile
(`git show`); `all` → full suite, `paths` → `vitest run --passWithNoTests <paths>`. Any failure → full suite.

## Phases
### Phase 1: CI scope for manifest changes (TDD)
- Tests first in `tests/repo/test-gates.test.ts`: a package manifest plus lockfile version bump reaches that package
  and its dependents plus `tests/`; a root `package.json` or a root tool in the lockfile runs the full suite; an
  unreadable base lockfile runs the full suite; source-only changes stay "related".
- `scripts/test-changed.mjs`: the new function and the CLI branch; comments in `lefthook.yml` and the AGENTS.md hook
  line.
- Done when: `npx vitest run tests/repo/test-gates.test.ts` passes, typecheck and lint pass, and a dry run on a real
  release bump commit prints the narrowed paths.

## Progress
- [ ] Phase 1: CI scope for manifest changes
