---
change_id: blog-cli-jobs-bundle-549
---

# Research: blog CLI and the optional jobs peer (issue #549)

## Findings

- `modules/blog/src/cli/run.ts` `queueIndexNow` does `await import("../jobs/enqueue.js")` when the config has a
  `blog.indexnow` queue. The specifier is a string literal, so esbuild resolves and inlines it.
- `modules/blog/src/jobs/enqueue.ts` imports `enqueueJob` from `@softure-ai/jobs/server` at the top. Inlined into an
  ESM bundle, an external import is hoisted to the bundle's top level, so it runs when the bundle loads (the startup
  failure the issue describes); a missing peer that is not external fails the build.
- `modules/blog/src/jobs/queue.ts` (`hasBlogIndexNowQueue`) imports only `@softure-ai/core`, so the CLI's question
  "is there a queue?" stays safe in the static graph.
- The other optional peers on the CLI path are loaded by literal dynamic imports of the packages themselves
  (`discovery/indexnow-target.ts` → `@softure-ai/seo`); with the package external, esbuild keeps those as runtime
  `import()` calls, which load only on that path. The issue is about jobs; seo is not changed.
- Precedent: `foundation/db/tests/bundle.test.ts` bundles a CLI entry with esbuild (root devDependency, `conditions:
  ["@softure-ai/source"]`) and runs it on real Node.
- Node resolves a package's own name through its `exports` (self-reference), so `import("@softure-ai/blog/jobs")`
  from inside the installed blog package loads `dist/jobs/index.js`. Vitest resolves it to `src/` through the
  `@softure-ai/source` condition (`vitest.config.mts`).
