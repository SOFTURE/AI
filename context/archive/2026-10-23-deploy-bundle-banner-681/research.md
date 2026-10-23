---
change_id: deploy-bundle-banner-681
status: archived
---

# Research

## Where the banner lives

- `tools/deploy/templates/Dockerfile.tmpl`: three esbuild commands (migrate, worker, ops) carry
  `--banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"`.
- `tools/deploy/src/init/generate.test.ts` asserts that banner string (count 3 in the full Dockerfile).
- `tools/deploy/README.md` ("Bundled for plain Node") describes the banner in prose, without the literal command.
- `tools/deploy/CHANGELOG.md` 0.1.8 history mentions the banner; history stays as it is.

## Reproduction

Bundled an entry that imports `startObservability` from `@softure-ai/observability/node` with esbuild 0.28.2 (the
version the template pins, also the root devDependency), `--platform=node --format=esm --target=node22` and the
current banner: the bundle keeps `import { createRequire } from "node:module";` (observability's
`src/node/start.ts:1`) next to the banner's import, and `node --check` fails with
`SyntaxError: Identifier 'createRequire' has already been declared`. With
`import { createRequire as __bundleCreateRequire } from 'module'; const require = __bundleCreateRequire(import.meta.url);`
`node --check` passes and the bundle runs. Bundling took about 0.2 s, so a unit test can do it.

esbuild renames clashing bundled identifiers (observability's local `require` became `require2`) but never parses the
banner, so a name in the banner must not be one a bundled module imports at the top level. `require` itself stays:
CJS shims in the bundle call it.

## Test approach

- esbuild's JS API is available from the root devDependency `esbuild` (^0.28.2); `@softure-ai/observability` is a
  workspace package. Declare it as a devDependency of deploy so the test's import is explicit. Resolve its source
  through the `@softure-ai/source` condition, so the test needs no build.
- Read the banner from the rendered `Dockerfile` (worker variant), so the test fails when the template regresses.
