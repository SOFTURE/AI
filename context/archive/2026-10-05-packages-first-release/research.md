# Research: packages-first-release

## Current state

Workspaces (`package.json` → `workspaces`): `foundation/*`, `modules/*`, `tools/*`, `templates/*`.
Releasable packages, 16: core, db, ui (foundation); analytics, auth, billing, blog, feature-switches,
mailing, mcp-access, ops, privacy, security, seo, waitlist (modules); marketing-kit (tools).
`templates/package` is private by design (its description says "drop private" on copy).

Where a version or an internal range lives:

| Place | What | Checked by |
| --- | --- | --- |
| `*/package.json` → `version` | 0.0.0 everywhere | `release-rules.mjs` `checkManifest` (tag = version) |
| `*/package.json` → `dependencies`, `peerDependencies`, `devDependencies` | `@softure-ai/*: ^0.0.0` | `checkInternalRanges` (deps and peers) in `tests/repo/packages.test.ts` |
| `modules/*/module.json` → `version`, `dependsOn` | 0.0.0, `^0.0.0` (blog: `^0.0.0?`) | `checkManifest` (module = package version) |
| `modules/*/src/index.ts` inline manifest | same values as `module.json` | each module's "ships a module.json equal to its manifest" test |
| `modules/{auth,billing,feature-switches,mcp-access,waitlist}/tests/module.test.ts` | error text `(^0.0.0)` | the tests themselves |
| `package-lock.json` | workspace versions | `npm ci` |
| `examples/next-app/package-lock.json` | `file:` links to the packages, with their versions | `npm ci` in the e2e job |
| `foundation/core|db|ui/package.json` → `private` | `true` | `checkManifest` refuses a private package on a tag |

`foundation/core/src/config.ts:126` checks `dependsOn` ranges against the listed modules' versions at
runtime, so a `^0.1.0` range against a 0.1.0 module passes.

## Gap

`scripts/release/version.mjs` updates `package.json` and `module.json` only. For a module with an inline
manifest (`src/index.ts`), its own "module.json equal to its manifest" test then fails, and so do the
gates the release workflow runs on the tag. The next bump after 0.1.0 hits it. Not fixed here (rule:
gaps go to the roadmap): LT-2 in `later`.

## Release order

Dependency layers (deps and peers): core, marketing-kit (no internal deps) → db, ui, seo → security,
ops, mailing → auth, analytics, blog → privacy, mcp-access, feature-switches, billing → waitlist.
Staging on npm does not resolve dependencies, so the order only matters for approval: a package is
installable once the packages it depends on are approved. GitHub starts no workflow for a push of
more than three tags.

## SOFTURE modules

Nothing generic is built; the change edits release metadata.

## Risks

- A missed range leaves `npm ci` linking from the registry (404): `checkInternalRanges` in
  `tests/repo/packages.test.ts` catches deps and peers; devDependencies are updated by the same script.
- The e2e lockfile drifting from the packages: regenerate it with npm, never by hand.

## Open questions

None.
