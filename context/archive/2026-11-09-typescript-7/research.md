# Research: typescript-7

## Findings

- `typescript@7.0.2`: `bin.tsc` is the native compiler; `exports["."]` is `./lib/version.cjs` (version only), the API
  lives under `./unstable/*`. Anything that does `import ts from "typescript"` and calls `ts.createSourceFile` breaks.
- `@typescript/typescript6@6.0.2` is Microsoft's compatibility package: the full TypeScript 6 API (`main:
  lib/typescript.js`), bin `tsc6`, so it installs next to TypeScript 7 without a bin clash.
- The TypeScript 7.0 announcement ("Running side-by-side with TypeScript 6.0") recommends exactly:
  `"@typescript/native": "npm:typescript@^7.0.2"` and `"typescript": "npm:@typescript/typescript6@^6.0.2"`.
  typescript-eslint closed TS 7.0 support as not planned (typescript-eslint#12518) and points to the same setup; its
  support is tracked for TS >= 7.1 (typescript-eslint#10940).
- Compiler API consumers in this repository: typescript-eslint (lint), `foundation/testing/src/guards/**` and
  `foundation/ui/src/testing/**` (published, optional peer `typescript >=5.0.0`), `modules/pwa/tests/built-worker.test.ts`,
  `themes/theme-notion/tests/inventory.test.ts` and `tests/gallery/source-classes.ts`.
- `tsc` users: the root `typecheck` script and every package `build` (`scripts/build-workspaces.mjs`).
- `examples/next-app` pins its own `typescript ~6.0.3` (Next.js type-checks with the compiler API); it stays as is.
