# Plan: modules-ui-peer-css-side-effects

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase plus docs).

## Goal

Blog marks its CSS as a side effect, all eight modules take `@softure-ai/ui` as a peer (plus a dev dependency), a
repository test keeps both rules for every future package, and every touched module carries a patch bump.

**Out of scope:** any module code, other shared singletons (core, db: #154 owns the database handle), publishing
(see change.md § Constraints).

## Findings (the reading behind the plan)

- `modules/blog/package.json`: `"sideEffects": false`, `files` and `exports` carry `./styles.css`. No other module
  ships a stylesheet.
- ui in `dependencies` (`^0.1.0`): auth, billing, blog, feature-switches, mailing, mcp-access, privacy, waitlist.
  Blog only imports `DEFAULT_THEME`; the others import components (`Button`, `Card`, `TextField`, `FormError`, …).
- Every symbol the eight modules import from `@softure-ai/ui` is exported since `ui@0.1.0` (checked per symbol in
  `git grep` over the `ui@0.1.x` tags).
- Measured: with `foundation/ui/src` replaced by the source of `ui@0.1.0`, `ui@0.1.3`, `ui@0.1.5` and `ui@0.1.6`,
  `tsc --noEmit` reports zero errors in the eight modules' non-test sources (ui and charts themselves do fail
  against 0.1.0, so the swap took effect).
- `checkInternalRanges` (`scripts/release/release-rules.mjs`) already checks `peerDependencies` ranges accept the
  workspace version, so a peer range is held to the same rule as a dependency.
- The module READMEs already list `@softure-ai/ui` in their install line, except blog (`npm install
  @softure-ai/blog`, which also omits its existing peers security and seo).

## Key decisions

- **D1 Peer range `^0.1.0`.** It is the widest range the modules are proven to work with (Findings), so no app that
  installs today is refused; a narrower floor would be a breaking change for nothing. Dev dependency `^0.1.7` (the
  workspace version), as charts does.
- **D2 Guards in `tests/repo/packages.test.ts`,** run for every workspace package: a package exporting a `.css` file
  declares `"*.css"` in `sideEffects`; no package other than ui lists `@softure-ai/ui` in `dependencies`, and a ui
  peer has a matching dev dependency. Written first and seen red on the current manifests.
- **D3 Patch bumps** (package.json and module.json together): auth 0.1.7, billing, blog, feature-switches, mailing,
  mcp-access, privacy, waitlist 0.1.6. No release in this change.
- **D4 Docs:** blog README install line lists its peers; `docs/02-module-standard.md` § Packaging states the ui-peer
  and CSS side-effect rules next to the React/Next one.

## Phase 1: manifests, guards, docs (TDD)

1. Add the two guards (D2); run `npx vitest run tests/repo/packages.test.ts` and see them fail for blog and the
   eight modules.
2. Edit the eight manifests (D1, D3), the eight `module.json` versions and the manifest version in each module's
   `src/index.ts` (found in impl review I1); `npm install` to refresh the lockfile;
   `git checkout .gitignore` if npm touched it.
3. Docs (D4).
4. Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Done when: the guards are green, gates are green, `npm pack --dry-run -w @softure-ai/blog` shows the new
`sideEffects`, and the lockfile lists ui as a peer of the eight modules.

## Progress

- [x] 1.1 Guards red
- [x] 1.2 Manifests and versions
- [x] 1.3 Docs
- [x] 1.4 Gates green
