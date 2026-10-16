---
change_id: blog-cli-jobs-bundle-549
status: archived
---

# Plan: blog CLI without the jobs peer in its static graph (issue #549)

Input: change.md, research.md. Complexity: small (one module, one option, one test file, docs).

## Phase 1: test first

File: `modules/blog/tests/cli-bundle-549.test.ts`, fixture `modules/blog/tests/fixtures/cli-bundle-entry.ts`.

1. esbuild bundles the fixture (an app's `scripts/blog.ts` calling `runBlogCli`) into one ESM file
   (`bundle: true`, no splitting) with a plugin that refuses every `@softure-ai/jobs` specifier. Red today: the
   build fails on `@softure-ai/jobs/server`.
2. The bundle runs on real Node and prints the usage (exit 2 on no command), so nothing at its top level needs jobs.

## Phase 2: fix

File: `modules/blog/src/cli/run.ts`.

1. `RunBlogCliOptions.enqueueIndexNow?: (ctx, changes) => Promise<BlogIndexNowSubmit>`, the shape of
   `enqueueBlogIndexNow`.
2. `queueIndexNow` uses it when given; otherwise loads `@softure-ai/blog/jobs` through a computed specifier (a
   constant passed through a variable, with `@vite-ignore` and `webpackIgnore`), typed with a type-only import.
3. Tests: the existing `cli.test.ts` queue tests keep passing (default path); a new test passes `enqueueIndexNow`
   and checks it is called with the commit's changes.

## Phase 3: docs

`modules/blog/README.md` (the bundling and job sections), `modules/blog/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: test first (`cli-bundle-549.test.ts` red before the fix: the build failed on `@softure-ai/jobs/server`
  from `jobs/enqueue.ts`; the bundle needs the usual `createRequire` banner for yaml, as any ESM bundle does)
- [x] Phase 2: fix (`enqueueIndexNow` option and the computed-specifier default; two CLI tests: the app's function
  is used, and its failure is the existing warning; the four existing queue tests pass unchanged)
- [x] Phase 3: docs (README bundling paragraph, CHANGELOG `## Unreleased`)

Gates on the branch: blog tests 716 passed; `npm run build` green; typecheck and lint before commit, full `npm test`
in pre-push.
