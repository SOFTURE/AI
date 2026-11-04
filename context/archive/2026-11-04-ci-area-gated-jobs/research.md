# Research: ci-area-gated-jobs

- Workspace packages: `foundation/*`, `modules/*`, `tools/*`, `themes/*`, `templates/*` (root `package.json`);
  `scripts/build-workspaces.mjs` already reads them (`findWorkspaces`).
- The example app (`examples/next-app`, not a workspace) installs 18 `@softure-ai/*` packages through `file:`; the
  e2e, Stripe sandbox and container jobs build and pack them. Their shipped dependencies (dependencies, peer,
  optional) close the set; development dependencies do not reach a packed package (`@softure-ai/deploy` has
  marketing-kit as a development dependency only).
- `tools/deploy/scripts/init-image.mjs` (deploy init image job) packs the example app with its packages.
- `tools/host/e2e/converge.sh` runs `tools/deploy/scripts/e2e-app-vars.ts`.
- `tools/marketing-kit` has no workspace dependencies; its film jobs depend on the lockfile (hyperframes).
- GitHub API limits: a pull request lists up to 3000 files, a compare up to 300; at the limit every area runs.
