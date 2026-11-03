# Research: deploy-worker-bundle-marketing-kit-995

## Reproduction (master fe3e7b5)

esbuild (the deploy package's own, the same flags as `templates/worker.Dockerfile.tmpl`, `@softure-ai/source`
condition) over an entry `import * as kit from "@softure-ai/marketing-kit"`:

- with the starter's externals only: fails with `No loader is configured for ".node" files` (resvg-js gnu and musl
  binaries) and `Could not resolve "chromium-bidi/lib/cjs/bidiMapper/BidiMapper"` / `.../cdp/CdpConnection`;
- with `--external:@softure-ai/marketing-kit` added: builds.

The issue's report is confirmed.

## Options

1. `--external:@softure-ai/marketing-kit`: the kit and everything under it (resvg, playwright, hyperframes, gsap) load
   from `node_modules` at run time; the kit's `createRequire(import.meta.url)` resolves its own dependencies there.
2. `--packages=external`: every package external. Rejected: the starter aliases `server-only` to an empty module so
   server packages load in plain Node; with packages external, `@softure-ai/*` modules that import `server-only`
   would import the real one at run time, which throws outside the `react-server` condition. It would also break a
   worker that imports a devDependency (pruned by `npm prune --omit=dev`).

## Files

- `tools/deploy/templates/worker.Dockerfile.tmpl` (the esbuild command and its comment)
- `tools/deploy/tests/` (a bundle test like `bundle-banner.test.ts`, using the flags of the generated file)
- `tools/deploy/CHANGELOG.md`, `tools/deploy/README.md`
