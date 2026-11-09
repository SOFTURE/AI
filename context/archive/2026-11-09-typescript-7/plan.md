# Plan: typescript-7

## Phases

1. Root devDependencies: `@typescript/native` = `npm:typescript@^7.0.2` (the `tsc` binary), `typescript` =
   `npm:@typescript/typescript6@^6.0.2` (the API for typescript-eslint, the guards and the tests). Refresh the
   lockfile; `npm ci` clean, `tsc -v` prints 7.0.x, `require("typescript").version` prints 6.0.x.
2. Make the tree pass under the TypeScript 7 `tsc`: typecheck and every package build; fix what TS 7 reports.
3. Published guards: `@softure-ai/testing` and `@softure-ai/ui` declare the optional peer as `>=5.0.0 <7.0.0` (the
   guards need the compiler API, which 7.0 does not ship) and their READMEs show the side-by-side setup. Changelog
   entries under `## Unreleased`.
4. Gates (typecheck, lint, language, full tests, build), PR, CI, merge on the coordinator's go, release testing and
   ui.

## Evidence

- p1: `npx tsc -v`, `node -p "require('typescript').version"`, clean `npm ci` (no ERESOLVE).
- p2: `npm run typecheck`, `npm run build` exit 0.
- p3: package tests of testing and ui green; `npm ci` resolves the peers without warnings.
- p4: CI run green on the PR, merge SHA, published versions.

## Decisions (auto)

- Follow the upstream side-by-side setup rather than keeping TypeScript 6 for `tsc`: Dependabot's bump lands, and the
  API stays on a supported package until TS 7.1 ships its new API.
- Narrow the guards' optional peer instead of rewriting them on `typescript/unstable/*`: that API is unstable and
  typescript-eslint, which every adopting app runs, needs the TS 6 API anyway.
- No Dependabot ignore: Dependabot keeps bumping `@typescript/native` (7.x) and `@typescript/typescript6` (6.x).

## Progress

- [x] p1 side-by-side install: clean `npm ci` (no ERESOLVE, no peer warnings), `npx tsc -v` = 7.0.2, `require("typescript")`
  = the TS 6 API (2631fae)
- [x] p2 `npm run typecheck` (tsc 7, 7 s) and `npm run build` (every package) exit 0 with no source change;
  `NODE_OPTIONS=--max-old-space-size=8192 npm run lint` exit 0 (2631fae)
- [x] p3 guards' peer range and docs; `vitest run foundation/testing foundation/ui modules/pwa themes/theme-notion`:
  2222 passed, 30 skipped (2631fae)
- [x] p4 PR #1218 all checks green on 6317664, merged as 421a0de (#1206 merged with it); release testing 0.5.1, ui 0.3.7
