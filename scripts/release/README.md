# Releasing a package

Every package in this repository is versioned and released on its own, by a tag
`<package>@x.y.z` (e.g. `core@0.1.0`). The tag runs [`release.yml`](../../.github/workflows/release.yml),
which publishes the package in three places:

| Where | Name | How |
| --- | --- | --- |
| npmjs.com | `@softure-ai/<package>` | staged through trusted publishing (OIDC) with provenance; live after the owner approves it |
| GitHub Packages | `@softure/<package>` | published with the workflow's `GITHUB_TOKEN` (GitHub requires the org as the scope) |
| GitHub Release | `<package>@x.y.z` | generated notes and the package tarball attached |

Releases are the owner's: agents never tag or publish (`release.owner` in
[`context/workflow.json`](../../context/workflow.json)).

## Release a version

```bash
git switch master && git pull
npm run release:version -- core minor     # patch | minor | major | prerelease | x.y.z
git push origin master core@0.2.0         # the command prints the exact line
```

`release:version` refuses a dirty tree, private packages and a bump that a dependent's
`@softure-ai/*` range would no longer accept (widen that range in its own commit first). It runs `npm version` for the workspace
(its `package.json` and the root lockfile), sets the same version in `module.json`, commits
`chore(release): core@0.2.0` and creates the annotated tag. It does not push.

The tag then runs the workflow:

1. **validate and pack**: a check that the tag is on `master`, the gates (typecheck, lint, test), `npm run build`, then
   `npm run release:pack -- --tag core@0.2.0`. It refuses the release when the tag, `package.json` and
   `module.json` disagree on the version, the package is private, `repository` or `publishConfig` is
   wrong, an internal `@softure-ai/*` range does not accept the workspace version, or the tarball
   misses an `exports` target, `LICENSE` or a source-map source, or ships a test.
2. **stage on npm**: `npm stage publish` of that exact tarball. Nothing is public yet.
3. **publish to GitHub Packages**: the same tarball, renamed to `@softure/<package>`.
4. **create the GitHub Release** with the tarball, once both registries succeeded.

Then **approve the staged version** on npmjs.com (package page → Staged Packages, 2FA), or
`npm stage list @softure-ai/core` and `npm stage approve <stage-id>`. Until then npm still serves the
previous version. A wrong version is rejected instead (`npm stage reject <stage-id>`); fix it, bump
again and tag the new version. A version number, once approved, can never be reused.

GitHub Packages and the GitHub Release do not wait for that approval: if you reject the npm stage,
delete the GitHub Release and the `@softure/<package>` version by hand (Packages → package →
Manage versions).

A version with a prerelease suffix (`1.0.0-beta.0`) goes to the `next` dist-tag on both registries
and makes a GitHub prerelease. A stable version gets npm's default `latest`; npm refuses to move
`latest` back to a lower version, so a backport (e.g. `0.1.5` after `0.2.0`) fails until it gets a
dist-tag of its own. Push at most three tags at once: GitHub starts no workflow for a push of more
than three tags.

## First release of a new package

npm can bind a trusted publisher only to a package that already exists, so the very first stage of a
package authenticates with a token:

1. On npmjs.com, create a granular access token with read and write access to the `@softure-ai`
   scope and a short expiry. Store it as the repository secret `NPM_TOKEN`
   (GitHub → Settings → Secrets and variables → Actions).
2. Release the version as above. The workflow tries OIDC first, then falls back to the token.
3. Approve the staged version on npmjs.com.
4. On the package's settings page, add a trusted publisher: GitHub Actions, organization `SOFTURE`,
   repository `AI`, workflow `release.yml`, allowed action **stage only**.
5. Delete the `NPM_TOKEN` secret (or keep it only while more new packages are on the way). Later
   releases need no token.

If npm refuses to stage a name that has never been published, publish that first version from the
tarball the workflow attached to the GitHub Release, once, from your machine:
`npm publish ./softure-ai-core-0.1.0.tgz --access public`, then continue at step 4.

Without `NPM_TOKEN`, the npm job of a new package fails with a message pointing here; GitHub Packages
and the GitHub Release are not created, so re-running the job after adding the secret is safe.

## First batch release (0.1.0)

Every package except the template is already at 0.1.0 on `master`, with `^0.1.0` ranges between them, so
the first release needs no `release:version`: tag the merged `master` and push the tags. The batches
follow the dependencies, so a package's dependencies are staged before it; at most three tags per push.

```bash
git switch master && git pull
for p in core db ui seo security ops mailing auth analytics blog privacy mcp-access \
  feature-switches billing waitlist marketing-kit; do git tag -a "$p@0.1.0" -m "$p@0.1.0"; done
git push origin core@0.1.0 db@0.1.0 ui@0.1.0
git push origin seo@0.1.0 security@0.1.0 ops@0.1.0
git push origin mailing@0.1.0 auth@0.1.0 analytics@0.1.0
git push origin blog@0.1.0 privacy@0.1.0 mcp-access@0.1.0
git push origin feature-switches@0.1.0 billing@0.1.0 waitlist@0.1.0
git push origin marketing-kit@0.1.0
```

Wait for a batch's release runs to stage their packages before pushing the next. Each package is new on
npm, so each run needs the `NPM_TOKEN` secret (see above). Then, package by package in the same order,
approve the staged version on npmjs.com and add its trusted publisher (steps 3 and 4 above). A package
installs from npm once the packages it depends on are approved too.

## Dry run

The same validation runs without publishing:

- on every pull request (every workspace package, private ones included);
- from the Actions tab: **release** → **Run workflow**, optionally with a package short name;
- locally: `npm run build && npm run release:pack -- --all --dry-run --out /tmp/release`.

## Re-running a release

Each job skips a registry that already has the version, so re-running a failed workflow finishes
what is missing. One exception: a version staged on npm and not yet approved is invisible to
`npm view`, so a re-run stages it again and npm refuses. Approve or reject the pending stage first.

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
