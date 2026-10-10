# Releasing a package

Every package in this repository is versioned and released on its own, by a tag
`<package>@x.y.z` (e.g. `core@0.1.0`). The tag runs [`release.yml`](../../.github/workflows/release.yml),
which publishes the package in three places:

| Where | Name | How |
| --- | --- | --- |
| npmjs.com | `@softure-ai/<package>` | published through trusted publishing (OIDC) with provenance, live at once |
| GitHub Packages | `@softure/<package>` | published with the workflow's `GITHUB_TOKEN` (GitHub requires the org as the scope) |
| GitHub Release | `<package>@x.y.z` | generated notes and the package tarball attached |

Releases are the owner's call (`release.owner` in [`context/workflow.json`](../../context/workflow.json)):
an agent starts one only on the owner's explicit word, through [Release from Actions](#release-from-actions).
npm takes each version as soon as its release passes, with no approval step, as in SOFTURE/SKILLS (owner,
2026-10-06); the gates in the workflow and that word are the review.

## Release from Actions

[`auto-release.yml`](../../.github/workflows/auto-release.yml) releases from one dispatch on `master`
(Actions → **auto-release** → **Run workflow**, or the GitHub tools of an agent session, which cannot push
tags). Input `packages`: `all` (every public package) or short names (`core auth`). For each one it takes the
version from `package.json` on `master`, creates the tag `<package>@<version>` unless it exists, and starts
`release.yml` on that tag, which publishes exactly as a pushed tag does. The run summary lists what was
tagged and what was skipped; `node scripts/release/plan-tags.mjs <all|package…>` prints the same plan
locally. A version must be bumped on `master` first (below, or in a pull request); an existing tag is
skipped, so re-run a failed release with **Run workflow** on the tag itself.

## Release a version

```bash
git switch master && git pull
npm run release:version -- core minor     # patch | minor | major | prerelease | x.y.z
git push origin master core@0.2.0         # the command prints the exact line
```

`release:version` refuses a dirty tree, private packages and a bump that a dependent's
`@softure-ai/*` range would no longer accept (widen that range in its own commit first). It runs `npm version` for the workspace
(its `package.json` and the root lockfile), sets the same version in `module.json` and in the inline
manifest of the module's `src/index.ts` (refusing, before any change, a module where it cannot find that one
`version`), renames the newest `## Unreleased` section of the package's `CHANGELOG.md` to the version (refusing
a changelog without one, or with an empty one), commits
`chore(release): core@0.2.0` and creates the annotated tag. It does not push.

The tag then runs the workflow:

1. **validate and pack**: a check that the tag is on `master`, the gates (typecheck, lint, test), `npm run build`, then
   `npm run release:pack -- --tag core@0.2.0`. It refuses the release when the tag, `package.json` and
   `module.json` disagree on the version, the package is private, `repository` or `publishConfig` is
   wrong, an internal `@softure-ai/*` range does not accept the workspace version, or the tarball
   misses an `exports` target, `LICENSE` or a source-map source, or ships a test.
2. **publish to npm**: `npm publish` of that exact tarball, through the package's trusted publisher.
3. **publish to GitHub Packages**: the same tarball, renamed to `@softure/<package>`.
4. **create the GitHub Release** with the tarball, once both registries succeeded.

A published version number can never be reused. A wrong version is fixed forward: fix it, bump again and
release the new version (`npm deprecate @softure-ai/core@0.2.0 "<reason>"` marks the bad one).

A version with a prerelease suffix (`1.0.0-beta.0`) goes to the `next` dist-tag on both registries
and makes a GitHub prerelease. A stable version gets npm's default `latest`; npm refuses to move
`latest` back to a lower version, so a backport (e.g. `0.1.5` after `0.2.0`) fails until it gets a
dist-tag of its own. Push at most three tags at once: GitHub starts no workflow for a push of more
than three tags.

## First release of a new package

npm can bind a trusted publisher only to a package that already exists, so the very first publish of a
package authenticates with a token:

1. On npmjs.com, create a granular access token with read and write access to the `@softure-ai`
   scope, allowed to publish without 2FA, and a short expiry. Store it as the repository secret
   `NPM_TOKEN` (GitHub → Settings → Secrets and variables → Actions).
2. Release the version as above. The workflow hands the token to npm only because the package is not
   on npm yet; once it is, every publish goes through the trusted publisher alone and the run says so
   in a notice.
3. On the package's settings page, add a trusted publisher: GitHub Actions, organization `SOFTURE`,
   repository `AI`, workflow `release.yml` (all case-sensitive), environment empty, **Allow npm publish**
   checked.
4. Delete the `NPM_TOKEN` secret (or keep it only while more new packages are on the way). Later
   releases need no token.

If npm refuses a name that has never been published, publish that first version from the tarball the
workflow attached to the GitHub Release, once, from your machine:
`npm publish ./softure-ai-core-0.1.0.tgz --access public`, then continue at step 3.

Without `NPM_TOKEN`, the npm job of a new package fails with a message pointing here; GitHub Packages
and the GitHub Release are not created, so re-running the job after adding the secret is safe.

To check the trusted publisher after step 3, release a patch version of the package: the "Publish to npm" step
of its run prints the notice "publishing through its trusted publisher (OIDC), without NPM_TOKEN". Provenance
alone proves nothing here, since the token publish of the first version carries it too. `@softure-ai/config` 0.1.1
was released this way.

## First batch release (0.1.2)

Every package except the template went out at 0.1.2, with `^0.1.0` ranges between them, so the first
release needed no `release:version`: run **auto-release** with `all` (or push the tags by hand,
at most three per push). Each package was new on npm, so each run needed the `NPM_TOKEN` secret (see
above). Then, package by package in dependency order (`node scripts/release/plan-tags.mjs all`), approve
the staged version on npmjs.com and add its trusted publisher (steps 3 and 4 above). A package installs
from npm once the packages it depends on are approved too.

The tags `<package>@0.1.0` and `<package>@0.1.1` exist without a release: 0.1.0 stopped at the test gate
(`release-gates-postgres`) and 0.1.1 at the npm stage (`release-stage-tarball-path`), both before anything
was published, and a tag is never moved, so the first release is 0.1.2. The
same holds for any release that fails before publishing: fix it on `master`, bump the patch version and
release again.

0.1.3 was meant as the first release without the token and failed every stage with E401 (nothing
published): the trusted publisher fields did not match this repository exactly (they are case-sensitive:
`SOFTURE`, `AI`, `release.yml`). 0.1.4 repeats it after the fix, and adds the first release of
`@softure-ai/deploy` and `@softure-ai/testing` (0.1.0, new on npm, so `NPM_TOKEN` again for those two only).
A package whose trusted publisher is missing or wrong fails at "Publish to npm" with E401 (or E403 when
the publisher does not allow `npm publish`); correct the publisher and re-run the failed job.

Up to 0.1.4 the workflow staged every version (`npm stage publish`) and the owner approved each one on
npmjs.com. From 0.1.5 it publishes directly, as SOFTURE/SKILLS does (owner, 2026-10-06), so each trusted
publisher must allow `npm publish`.

## Dry run

The same validation runs without publishing:

- on every pull request (every workspace package, private ones included);
- from the Actions tab: **release** → **Run workflow**, optionally with a package short name;
- locally: `npm run build && npm run release:pack -- --all --dry-run --out /tmp/release`.

## Re-running a release

Each job skips a registry that already has the version, so re-running a failed workflow finishes
what is missing.

## What a package ships

`files` in each `package.json` ships `dist/` (ESM and `.d.ts` built by `tsc`), `src/` without tests
(so source maps and the `@softure-ai/source` export condition resolve for consumers), `migrations/`
and `module.json`. The pack step adds the repository `LICENSE`. Start a package from
[`templates/package/`](../../templates/package/README.md): it already has the publishable shape, and
`tests/repo/packages.test.ts` checks every workspace package against the same rules as a release.

## Installing a release

| Source | Command |
| --- | --- |
| npm | `npm i @softure-ai/core` |
| GitHub Release (no registry, no auth) | `npm i https://github.com/SOFTURE/AI/releases/download/core%400.1.0/softure-ai-core-0.1.0.tgz` |
| GitHub Packages | `npm i @softure/core` with `@softure:registry=https://npm.pkg.github.com` and a token with `read:packages` |

A package from GitHub Packages still depends on the other packages as `@softure-ai/*`, from npm.
