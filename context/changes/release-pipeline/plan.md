# Plan: release-pipeline

Input: change.md, research.md. Complexity: medium (one workflow, three small scripts, a template rule; no data; the only real risk is a public, irreversible publish, which staging and checks contain).

## Goal

Pushing a tag `<package>@x.y.z` (e.g. `core@0.1.0`) runs `.github/workflows/release.yml`, which validates that package, stages `@softure-ai/<package>` on npm through trusted publishing with provenance (live after the owner's 2FA approval), publishes `@softure/<package>` to GitHub Packages and creates a GitHub Release `<package>@x.y.z` with the tarball. The same workflow runs as a dry run (build, pack, validate, no publish) on every pull request and on `workflow_dispatch`, and that dry run is green in CI. The owner bumps a version and creates the tag with one command.

**Out of scope:** any real tag or publish (FD-8, owner); creating `foundation/core` or any real package (FD-3 and later); npm account settings, secrets and trusted-publisher configuration (owner steps, documented in the runbook); a changelog file per package.

## Approach

**Starting point:** no release path; `ci.yml` ignores tags (`.github/workflows/ci.yml:2`). Workspaces build with `npm run build` in dependency order (`scripts/build-workspaces.mjs:79-115`). The only workspace package is the private template (`templates/package/package.json`), whose maps and `@softure-ai/source` exports point at `src/`, which `files` does not ship (research, Answers 4).

**Chosen:** one `release.yml` for every package, modelled on SOFTURE/SKILLS `release.yml`, with the package logic in tested scripts under `scripts/release/`: a validate+pack job that produces the exact tarball, then npm staging, GitHub Packages and the GitHub Release consume that tarball. Every npm release is staged (`npm stage publish`), so nothing goes live without the owner's 2FA approval.
Rejected: one workflow per package (SOFTURE/API style) - ten copies to keep in sync, and npm does not need it; Changesets - a version-PR flow and its own tag format the roadmap does not use; direct `npm publish` like SKILLS - npm's trusted-publishing configurations stage by default since 2026-09-03 and a mistaken version cannot be reused.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Workflow files | one `release.yml` | each package registers the same trusted publisher (`SOFTURE`/`AI`/`release.yml`) | research |
| Versioning | `npm version -w` wrapped by `scripts/release/version.mjs` | keeps `module.json` in sync and tags `<package>@x.y.z`; no Changesets | research |
| npm publish mode | `npm stage publish` of the validated tarball, OIDC, `--provenance` | owner approval is the last gate; publishes exactly what was checked | research |
| First publish of a new package | same command authenticated by the `NPM_TOKEN` secret; clear failure when absent | trusted publishing needs an existing package | research |
| Packaging (backlog F6) | ship `src/` without tests | maps and `@softure-ai/source` exports resolve inside the tarball | research |
| License | root `LICENSE` copied into the package for the pack, removed after | MIT requires the text in each copy; one source of truth | plan |
| npm CLI in CI | `npm@11` (>= 11.15.0 checked) on Node 22 | npm 12 rejects the Node 22 patch runners may carry | research |
| Prereleases | version with `-` → `--tag next` on npm, `--prerelease` on GitHub | npm requires an explicit dist-tag for prereleases | research |
| Internal dependency ranges | must be satisfied by the workspace version (`semver`) | otherwise npm installs from the registry instead of linking | research |

**Critical details:**
- `actions/setup-node` with `registry-url` writes an `.npmrc` that reads `NODE_AUTH_TOKEN`. The npm job passes `secrets.NPM_TOKEN` (empty once the owner deletes it): npm tries OIDC first and falls back to the token only when no trusted publisher matches, so one step serves both the first and later releases.
- The GitHub Packages job must not rebuild: it unpacks the validated tarball, renames it to `@softure/<package>`, replaces `publishConfig` (provenance is unsupported there) and publishes the folder.
- A tag can point at any commit, so the tag run repeats the gates (typecheck, lint, test) before packing; PR runs skip them because `ci.yml` already runs them.
- No `${{ }}` expression that carries user-controlled text (the tag name, the `workflow_dispatch` input, step outputs derived from them) is interpolated into a `run:` script; they reach the shell through `env:` only, and the pack script validates them before anything uses them.
- "The version is already on the registry" means `npm view <name>@<version> version --json` succeeded. Only an `E404` error means "absent"; any other error fails the job, so a registry outage never looks like a missing package.

## Phase 1: Release rules as pure functions
**Discipline:** TDD. **Files:** `scripts/release/release-rules.mjs`, `tests/repo/release-rules.test.ts`, `package.json` (`semver`, `@types/semver` dev dependencies)

1. `scripts/release/release-rules.mjs`: `parseReleaseTag(tag)` → `{ ok: true, shortName, version, isPrerelease } | { ok: false, reason }`. Strict form `^([a-z0-9][a-z0-9-]*)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$` plus `semver.valid`.
2. Same file: `findReleasePackage(packages, shortName)` over `findWorkspaces()` results with manifests: the workspace whose `name` is `@softure-ai/<shortName>`; failure names the tag and the known names.
3. Same file: `checkManifest({ manifest, dir, version, moduleVersion, workspaceVersions, allowPrivate })` → list of problems (strings naming the field and both values): not private (unless `allowPrivate`), `version` equals the tag version, `module.json` version equals it when present, `license` is `MIT`, `repository` is `{ type: "git", url: "git+https://github.com/SOFTURE/AI.git", directory: dir }`, `publishConfig` is `{ access: "public", provenance: true }`, `files` contains `dist` and `src` and no entry is `tests` or starts with `tests/`, every internal `@softure-ai/*` dependency range is satisfied by that workspace's version.
4. Same file: `checkPackedFiles({ manifest, files, sourceMaps })` → problems: `package.json`, `README.md`, `LICENSE` present; every `exports` target (all conditions) present; no `*.test.ts(x)` and no `tests/`; every `sources` entry of every packed `.map` resolves to a packed file. `sourceMaps` is `{ path, sources }[]` read by the caller.

**Tests:** valid tag, prerelease tag, missing `@`, `v` prefix, uppercase name, bad SemVer (`1.2`, `01.2.3`); package found / not found / private template; each manifest rule failing alone; internal range satisfied and unsatisfied; packed list missing an export target, carrying a test file, a map source missing; a fully valid input returns no problems.

**Done when:**
- Automated: `tests/repo/release-rules.test.ts` passes and each rule has a failing case seen red before its implementation; Gates green (typecheck, lint, test).

## Phase 2: Pack command and publishable template
**Discipline:** test-after. **Files:** `scripts/release/pack.mjs`, `tests/repo/release-pack.test.ts`, `templates/package/package.json`, `tests/repo/packages.test.ts`, `package.json` (`release:pack` script)

1. `scripts/release/pack.mjs`: CLI `--tag <tag>` (release) or `--package <shortName> | --all` with `--dry-run` (private packages allowed), `--out <dir>`. For each package: copy root `LICENSE` in when absent, `npm pack --json --pack-destination <out> -w <dir>`, remove the copied `LICENSE` (in `finally`), read the packed `.map` files from the package folder, run `checkManifest` and `checkPackedFiles`, print one line per problem, exit 1 on any problem. With `GITHUB_OUTPUT` set, write `tarball`, `version`, `short-name`, `npm-tag` (`latest` or `next`) and `prerelease`. Export `packPackage()` for the test.
2. `templates/package/package.json`: `files` becomes `["dist", "src", "!src/**/*.test.ts", "!src/**/*.test.tsx", "migrations", "module.json"]`; add `repository` (`directory: "templates/package"`) and `publishConfig`. It stays private.
3. `tests/repo/packages.test.ts`: every workspace package ships `src`, has `repository` with its own `directory` and the public `publishConfig`, so a package copied from the template is publishable or fails with the field named.
4. `tests/repo/release-pack.test.ts`: builds the template (`tsc -p tsconfig.build.json`, as `npm run build` does) and runs `packPackage` in dry-run mode into a temp folder: no problems, the tarball holds `dist/index.js`, `src/index.ts`, `LICENSE`, no `tests/`, and the template folder has no `LICENSE` afterwards.
5. `package.json`: `"release:pack": "node scripts/release/pack.mjs"`.

**Tests:** template dry run clean; LICENSE cleanup; `packages.test.ts` new rules on all packages.

**Done when:**
- Automated: `npm run release:pack -- --all --dry-run --out <tmp>` exits 0 after `npm run build` and lists the template tarball; `npm run release:pack -- --tag template-module@0.0.0 --out <tmp>` exits 1 naming `private`; release-pack test passes; Gates green (typecheck, lint, test).

## Phase 3: Version command for the owner
**Discipline:** TDD. **Files:** `scripts/release/version.mjs`, `tests/repo/release-version.test.ts`, `package.json` (`release:version` script)

1. `scripts/release/version.mjs`: CLI `<shortName> <patch|minor|major|prerelease|x.y.z>`. Refuses a dirty tree and a private package. Runs `npm version <bump> -w <dir> --no-git-tag-version` (updates the package and the lockfile), writes the new version into `module.json` when present, commits `chore(release): <shortName>@<version>` with the three files and creates the annotated tag `<shortName>@<version>`. It never pushes; it prints `git push origin <branch> <tag>`.
2. Pure helpers, exported and tested: `getReleaseTag(shortName, version)` and `setModuleVersion(text, version)` (keeps the file's formatting, replaces only the top-level `version`).
3. `package.json`: `"release:version": "node scripts/release/version.mjs"`.

**Tests:** tag name for a release and a prerelease; `setModuleVersion` on the template `module.json`, on a file without `version` (problem returned), and that other keys are unchanged.

**Done when:**
- Automated: release-version tests pass after being seen red; `npm run release:version -- template-module patch` refuses with "private"; Gates green (typecheck, lint, test).

## Phase 4: Release workflow and runbook
**Discipline:** test-after. **Files:** `.github/workflows/release.yml`, `scripts/release/README.md`, `docs/02-module-standard.md`, `context/backlog/packaging.md`, `templates/package/README.md` (only if it describes `files`)

1. `.github/workflows/release.yml` (name kept: npm binds trusted publishers to it). Triggers: `push.tags: ["*@*.*.*"]`, `pull_request`, `workflow_dispatch` with input `package` (short name, empty = all). `permissions: contents: read`. `concurrency: release-${{ github.ref }}`, no cancel.
   - `validate`: checkout, Node 22, `npm ci`; on tags `npm run typecheck`, `npm run lint`, `npm test`; `npm run build`; `npm run release:pack` with `--tag "$GITHUB_REF_NAME"` on tags, else `--dry-run` with `--package` or `--all`; upload the tarballs as artifact `release`; outputs from `GITHUB_OUTPUT`.
   - `publish-npm` (tags only; `id-token: write`): download the artifact, Node 22 with `registry-url: https://registry.npmjs.org`, `npm install -g npm@11` and fail when < 11.15.0; skip when `npm view <name>@<version>` exists; when the package does not exist and `NPM_TOKEN` is empty, fail with the owner step; else `npm stage publish <tarball> --provenance --access public --tag <npm-tag>` with `NODE_AUTH_TOKEN: secrets.NPM_TOKEN`.
   - `publish-github` (tags only; `packages: write`): unpack the tarball, rename to `@softure/<shortName>`, `publishConfig` → GitHub registry, skip when the version exists, `npm publish` with `GITHUB_TOKEN`.
   - `github-release` (tags only; needs both publish jobs; `contents: write`; `fetch-depth: 0`): notes start at the previous `<shortName>@*` tag (`git tag --list --sort=-v:refname`) when there is one; `gh release create <tag> <tarball> --verify-tag --generate-notes --title <tag> --notes <install lines + "staged on npm, live after approval">`, `--prerelease` when applicable; `gh release upload --clobber` when it exists.
2. `scripts/release/README.md`: the owner runbook: bump and tag, push, approve the staged version on npmjs.com, first publish of a new package (granular `NPM_TOKEN` scoped to `@softure-ai`, then the trusted publisher `SOFTURE`/`AI`/`release.yml` with stage only, then delete the token), the fallback when npm refuses to stage a new name (`npm publish <tarball from the GitHub Release>` once by the owner), dry run from the Actions tab, install lines for the three sources.
3. `docs/02-module-standard.md` §12: replace "Changesets or `npm version -w`, chosen in FD-2" with the decision and link the runbook; state that packages ship `src/` for maps and the source condition.
4. `context/backlog/packaging.md`: tick the F6 entry with the decision and this change id.

**Done when:**
- Automated: the `release` workflow's `validate` job is green on this change's pull request (dry run over all packages); `publish-*` and `github-release` jobs are skipped there; links in the new README resolve (repo link test); Gates green (typecheck, lint, test).
- Manual: a `workflow_dispatch` dry run on `master` is green after the merge (an agent can trigger it); the first real tag and publish (FD-8, owner).

## Risks and rollback

- A staged but not yet approved version is invisible to `npm view`, so re-running a tag stages again and npm refuses the duplicate → the job fails loudly; the runbook says to approve or reject the pending stage (`npm stage list`) before re-running.
- Staging a tarball path or a never-published name behaves differently than npm documents → the npm job fails before anything goes live; the runbook names the owner fallback. Revert: none needed, nothing is published.
- A check is too strict for a future package (e.g. a package without `src/`) → the failure names the field; loosen the rule in `release-rules.mjs` with a test.
- The template rules break FD-3's package after this merges → `packages.test.ts` names the missing field; the coordinator tells FD-3. Revert of any phase: `git revert` of its commit; nothing outside the repository changes until a tag is pushed.

## Decisions (auto)

- Complexity → medium (one workflow and three scripts, no data).
- Test the CLI through the template rather than a fake package → the template is the real shape every package copies.
- Version command commits and tags locally but never pushes → the owner decides when it leaves the machine; agents never run it (`release.owner`).
- `workflow_dispatch` input is a short name, empty means every package → the roadmap's dry run must pass before any real package exists.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Release rules as pure functions

#### Automated
- [x] 1.1 `tests/repo/release-rules.test.ts` passes; each rule's failing case was seen red before its implementation — c7ac70e
- [x] 1.2 Gates green (typecheck, lint, test) — c7ac70e

### Phase 2: Pack command and publishable template

#### Automated
- [x] 2.1 `npm run release:pack -- --all --dry-run --out <tmp>` exits 0 after `npm run build` and lists the template tarball — 0505922
- [x] 2.2 `npm run release:pack -- --tag template-module@0.0.0 --out <tmp>` exits 1 naming `private` — 0505922
- [x] 2.3 `tests/repo/release-pack.test.ts` and the new `packages.test.ts` rules pass — 0505922
- [x] 2.4 Gates green (typecheck, lint, test) — 0505922

### Phase 3: Version command for the owner

#### Automated
- [x] 3.1 `tests/repo/release-version.test.ts` passes after being seen red — 60aea98
- [x] 3.2 `npm run release:version -- template-module patch` refuses with "private" and leaves the tree clean — 60aea98
- [x] 3.3 Gates green (typecheck, lint, test) — 60aea98

### Phase 4: Release workflow and runbook

#### Automated
- [x] 4.1 The `release` workflow's `validate` job is green on this change's pull request, and the publish and release jobs are skipped — 9fc93ca
- [x] 4.2 Links in `scripts/release/README.md` and `docs/02-module-standard.md` resolve (repository link test) — 9fc93ca
- [x] 4.3 Gates green (typecheck, lint, test) — 9fc93ca

#### Manual
- [ ] 4.4 A `workflow_dispatch` dry run on `master` is green after the merge
- [ ] 4.5 The first real tag stages on npm, lands on GitHub Packages and creates a GitHub Release (FD-8, owner)
