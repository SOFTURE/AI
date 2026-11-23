# Plan: deploy-host-scoped-npx

## Approach

1. `host`: `formatHostCommand(version, args)` returns `npx --yes @softure-ai/host@<version> <args>`; `server` ends
   with `next: npx --yes @softure-ai/host@<version> app add --inventory=<file> --app=<slug>` (the inventory path as
   passed). `app add` without deploy.sh says: run `npx softure-deploy init` in the app first, after `npm install
   --save-dev @softure-ai/deploy`. The version comes from `readPackageVersion()`.
2. READMEs: "Running the CLI" in both; host's top examples pinned; CHANGELOG `## Unreleased` entries.

## Decisions (auto)

- The `app add` message keeps the in-app form, made explicit: host cannot know the app's deploy version, and init's
  files pin the deploy version of the package that wrote them, so init should run from the app's own dependency.
- No placeholder packages on npm (owner's call); named on the issue as an option.
- Deploy usage errors keep the bare bin name: they answer a command the user has just run.

## Phases

1. Host messages with failing-first tests (`cli.test.ts`), host README and CHANGELOG.
2. Deploy README "Running the CLI" and CHANGELOG.

## Acceptance

- `npx vitest run tools/host` green; the new `server` test fails before the change.
- `git grep -n "npx softure-\(deploy\|host\)"` lists only lines the README marks as app context.
- typecheck and lint green.

## Progress

- [x] Phase 1 (ffaf606): `server` prints `next: npx --yes @softure-ai/host@<version> app add --inventory=<file>
      --app=<slug>`; `app add` without deploy.sh names the in-app install and `npx softure-deploy init`; new test
      "prints the next step as the scoped, pinned package, runnable outside any project (issue #1436)" and the updated
      deploy.sh test failed before (2 of 13) and pass after; `npx vitest run tools/host` 57 of 57; host README
      "Running the CLI", CHANGELOG.
- [x] Phase 2 (bce0532): deploy README "Running the CLI", CHANGELOG; `npx vitest run tests/repo` 33 files green
      (after installing ssh-keygen in the container), init README tests 61 of 61.
