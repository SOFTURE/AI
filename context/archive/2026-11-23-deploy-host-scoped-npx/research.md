# Research: deploy-host-scoped-npx

## Where the unscoped form appears (git grep, master 29bee6c)

- `tools/deploy/README.md`: `npx softure-deploy help` (after `npm install --save-dev`), two `run:` steps of an app's
  deploy job, the `integration.remote`/`lookup` commands of an app's `workflow.json`, `schema-guard` inside the app
  image. All are app contexts (the package is a dependency or in the image), but the README never says so.
- `tools/host/README.md`: `npx @softure-ai/host server|app add` (scoped, but not pinned).
- `tools/host/src/cli/server-command.ts`: the final line prints `next: softure-host app add --app=<slug>`, a bare
  bin that exists only where host is installed, without the required `--inventory`.
- `tools/host/src/cli/app-add-command.ts`: `run softure-deploy init in the app first`.
- `tools/deploy` CLI: no printed next step names a `softure-deploy` command; usage errors name the bin the user
  just ran (`for example softure-deploy verify …`), which is right. Generated workflows and `deploy.sh` already use
  `npx --yes --package=@softure-ai/deploy@<version> softure-deploy …` / `npx --yes @softure-ai/deploy@<version>`.

## Facts

- `host` knows its own version (`readPackageVersion()` in `src/cli/context.ts`, read from its `package.json`).
- `host` has one bin, so `npx --yes @softure-ai/host@<version> <command>` runs it; `deploy` has one bin too, but the
  explicit `--package … softure-deploy` form is what its workflows already use.
- `host` does not know which `deploy` version an app should use; deploy init belongs in the app as a devDependency
  (deploy README), so the in-app form is the right instruction there.
