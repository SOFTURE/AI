# Research: release-pipeline

Input: change.md, roadmap FD-2, research.sources (`docs/`, `../SKILLS/`, `../API/.github/workflows/`, `../../FIRE_TRACKER/`), npm documentation. Depth: normal (publishing is public and irreversible, but no data, money or auth is involved).
Snapshot: 0894bd9 on claude/fd-2-release-pipeline-y0qm8t, 2026-10-02 11:30 UTC.

## Summary

- There is no release path today: `.github/workflows/` holds only `ci.yml` (no tags) and the only workspace package is the private template (`templates/package/package.json:4`). `foundation/core` and the rest are README-only folders; FD-3 creates the first real package in parallel.
- The reference is SOFTURE/SKILLS `release.yml`: validate + pack, then npm (OIDC, provenance), GitHub Packages (renamed to `@softure/*`), GitHub Release with the tarball. It is single-package and keyed on `vX.Y.Z`; this repo needs a per-package tag `<package>@x.y.z` and a lookup from the tag to a workspace.
- npm changed since SKILLS was written: staged publishing (`npm stage publish`, CLI >= 11.15.0) is GA, and since 2026-09-03 every trusted-publishing configuration stages by default, direct publish is opt-in. A staged version goes live only after a maintainer approves it with 2FA. This is exactly the "owner approves" step the roadmap asks for, so every release should stage.
- Trusted publishing cannot be configured before a package exists on npm. A brand-new package's first stage therefore needs a token (`NPM_TOKEN`); afterwards the owner adds the trusted publisher and the token can go.
- Packaging (backlog F6): the build emits `.js.map`/`.d.ts.map` pointing at `../src/*.ts`, and every `exports` entry carries a `@softure-ai/source` condition pointing at `./src/*.ts`. Neither resolves in a tarball without `src/`. Shipping `src/` (minus tests) fixes both at once.
- `module.json` carries its own `version` (`templates/package/module.json:3`), so a version bump must keep it equal to `package.json`.

## Current state

- CI: `.github/workflows/ci.yml:6-16` runs on every branch push and PR; tags are explicitly left to "their own workflow" (`ci.yml:2`). Jobs: static (typecheck + lint), test, build; Node 22, `actions/checkout@v7`, `actions/setup-node@v7`, `npm ci`.
- Build: `npm run build` → `scripts/build-workspaces.mjs` orders workspaces by their `@softure-ai/*` dependencies (`orderWorkspaces`, `:79-101`) and runs each package's `build` (`tsc -p tsconfig.build.json`, enforced by `tests/repo/packages.test.ts:58-64`). Packages build against the `dist/` types of their dependencies (`templates/package/tsconfig.build.json:10-11`), so a single package cannot be built before its dependencies.
- Package shape (template, `templates/package/package.json`): `private: true`, `version: 0.0.0`, `files: [dist, migrations, module.json]`, exports with `@softure-ai/source` → `./src/*.ts`, `types` → `./dist/*.d.ts`, `default` → `./dist/*.js`. No `repository`, no `publishConfig`, no `LICENSE` file in the package (root `LICENSE` only).
- `tsconfig.build.json` emits `sourceMap` and `declarationMap` (`templates/package/tsconfig.build.json:7-9`).
- Tests for scripts live in `tests/repo/*.test.ts` and import the `.mjs` script directly (`tests/repo/build-order.test.ts:2`); scripts are plain ESM with `// @ts-check` + JSDoc and are typechecked by the root `tsconfig.json` (`allowJs`, `checkJs`, includes `**/*.mjs`) and linted with typed rules (`eslint.config.mjs:14`).
- Repository: SOFTURE/AI is public (GitHub API, `private: false`), which npm provenance requires. Default branch `master`.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Release workflow | `.github/workflows/release.yml` (new) | tag → validate → npm stage → GitHub Packages → GitHub Release; dry run on PRs and `workflow_dispatch` |
| Release scripts | `scripts/release/*.mjs` (new) | tag parsing, workspace lookup, manifest and tarball checks, pack, version bump |
| Repo tests | `tests/repo/release-*.test.ts` (new), `tests/repo/packages.test.ts` | unit tests of the scripts; package shape rules (`src` in `files`, `repository`, `publishConfig`) |
| Package template | `templates/package/package.json` | publishable shape: `files` with `src`, `repository`, `publishConfig` |
| Docs | `docs/02-module-standard.md` §12, `scripts/release/README.md` (new), `context/backlog/packaging.md` | record the decisions; owner runbook |
| Root manifest | `package.json` | `release:*` scripts; `semver` dev dependency |

## Data

None. No database, no migrations.

## Tests

- `npm test` (Vitest, `vitest.config.mts:29-33` includes `tests/**/*.test.ts`) runs the repository tests in seconds. New release scripts get unit tests there, following `tests/repo/build-order.test.ts`.
- Nothing can test a real publish without publishing. The proof available to an agent is the dry run: pack + validate in CI on the PR and through `workflow_dispatch` (the roadmap Baseline).
- Gap: `actionlint` is not installed; workflow syntax is only proven by GitHub parsing the file on the PR.

## Patterns to follow

- Scripts: `// @ts-check`, JSDoc types, exported pure functions + a `runCli()` guarded by `process.argv[1]` (`scripts/build-workspaces.mjs:103-115`). Error messages name the operation and the input (`build-workspaces.mjs:68`).
- Workflow style: comments at the top explaining triggers, `permissions: contents: read` by default with per-job escalation (`ci.yml:18-19`, SKILLS `release.yml:20-21,61-64`).
- SKILLS idempotency: skip a registry when the version is already there (`../SKILLS/.github/workflows/release.yml:76-80,103-107`); `gh release upload --clobber` when the release exists (`:128-133`).
- SOFTURE/API: one workflow per package, triggered by a GitHub Release (`../API/.github/workflows/release-cqrs-package.yml:3-5`). Ten near-identical files; a NuGet API key, no OIDC. Not a pattern to copy here.
- FIRE_TRACKER has no release workflow; it is a consumer and not relevant to publishing.

## Prior work

- `context/archive/2026-10-02-monorepo-tooling/reviews/impl-review.md:94-100` (F6): maps point at unpublished `src/`; deferred to FD-2 through `context/backlog/packaging.md:5`.
- `context/foundation/lessons.md` L-001: packages build with `tsc`; the release must not introduce a bundler.
- `docs/02-module-standard.md:194-205` §12: tag-driven, one tag per package, three destinations, staged first publish approved by the owner, agents never tag or publish; "Changesets or `npm version -w`, chosen in FD-2".
- `context/foundation/prd.md:31-32,55` (G-4, FR-2).

## SOFTURE modules

Not applicable: this is repository tooling, not an app capability.

## Risks

- **A wrong version goes public** (medium likelihood without checks, high cost: versions cannot be reused). Mitigation: tag ↔ `package.json` ↔ `module.json` equality check, staged publishing (nothing is live before the owner's 2FA approval), dry run on every PR.
- **Tarball misses a file an `exports` entry points at** (medium). Mitigation: check every export target and every source-map source against the packed file list.
- **Internal dependency range drifts** (e.g. `db` depends on `@softure-ai/core@^0.1.0` while core is `0.2.0`): npm silently installs from the registry instead of linking. Mitigation: validate internal ranges against workspace versions.
- **First publish of a new package fails on auth** (certain without a token). Mitigation: `NPM_TOKEN` fallback with an explicit error naming the owner step; documented runbook.
- **Unverified CLI behaviour** (staging a tarball path via OIDC; staging a never-published name). The npm docs say staging a new package creates a public `0.0.0-stage` placeholder; an older article (InfoQ, 2026-08) says new packages cannot be staged. Mitigation: the runbook names the fallback (owner runs `npm publish <tarball>` from the GitHub Release once); the workflow fails loudly, never half-publishes silently.
- **npm 12 drops Node 22.22.0** (measured locally: `npm@12.2.0` warns "supports `^22.22.2 || ^24.15.0`"). Mitigation: pin `npm@11` (latest 11.21.0, >= 11.15.0 needed for staging) instead of `npm@latest`.
- **Collision with FD-3**: FD-3 creates `foundation/core/package.json` from the template. If FD-2 changes the template and adds shape rules, FD-3's package must follow them after FD-2 merges. Mitigation: tell FD-3 through the coordinator; the rule failure message says exactly what to add.

## Relevant lessons

- L-001: the release packs what `tsc` built; no bundler step is added.

## Answers to unknowns

1. **One workflow for all packages vs. one per package** → one `release.yml`. npm binds a trusted publisher to (repository, workflow file name[, environment]) per package; each package simply registers the same `SOFTURE/AI` + `release.yml`. Up to 10 trusted publishers per package are allowed (npm docs, trusted-publishers), so one file never blocks a package. One file means one place to fix, unlike SOFTURE/API's ten copies.
2. **Changesets vs. plain `npm version -w`** → plain `npm version -w` wrapped in a small script. Changesets brings a version-PR flow, its own tag format (`@softure-ai/core@x.y.z`, not `core@x.y.z`) and changelog files; the owner tags by hand and GitHub generates notes per tag. The wrapper also keeps `module.json` in sync, which neither tool does.
3. **First publish of a brand-new package** → `npm stage publish` with an `NPM_TOKEN` (trusted publishing cannot exist before the package does), the owner approves it with 2FA on npmjs.com, then adds the trusted publisher (`SOFTURE`/`AI`/`release.yml`, stage only). Every later release stages through OIDC with no token.
4. **Ship `src/` or drop maps (backlog F6)** → ship `src/` without tests. It makes the maps useful (go-to-definition lands in TypeScript) and makes the `@softure-ai/source` export targets real files, so the published `exports` has no dangling path. Cost: a larger tarball, acceptable for a library.
5. **Does provenance need anything extra?** → public repo (yes), `id-token: write`, `repository.url` equal to the GitHub repo (`git+https://github.com/SOFTURE/AI.git`), with `directory` set for a monorepo package.

## Open questions

- Tag glob vs. strict format: decided (auto): the trigger uses a loose glob (`*@*.*.*`), the script enforces the strict SemVer regex and fails with the reason.
- Prereleases: decided (auto): a version with a `-` suffix stages with `--tag next` and makes a GitHub prerelease; npm 11 refuses a prerelease without an explicit tag.
- GitHub Packages dependencies: answered: internal dependencies stay `@softure-ai/*` in the renamed `@softure/*` package and resolve from npm, as SKILLS's package has no internal deps to compare; documented in the runbook.

## Decisions (auto)

- Depth normal → publishing is irreversible but the surface is two new files and a few rules; no data, auth or money.
- Framing skipped → the Outcome names a user-visible result (a tag publishes), research found no cheaper mechanism, and the one fork (staging for every release) follows from npm's current defaults rather than taste.
- Every release stages, not only the first → trusted-publishing configurations stage by default since 2026-09-03 and the roadmap calls versions irreversible; the owner's 2FA approval is the last gate.
- npm pinned to major 11 → npm 12 does not support the Node 22 patch the runners may carry.
