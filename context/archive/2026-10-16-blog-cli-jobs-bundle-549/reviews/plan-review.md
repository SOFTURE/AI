---
change_id: blog-cli-jobs-bundle-549
reviewed: 2026-10-16
verdict: approved
---

# Plan review: blog-cli-jobs-bundle-549

Checked plan.md against change.md, research.md, issue #549 and `cli/run.ts`, `jobs/enqueue.ts`, `jobs/queue.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A bundle that runs the default path has no `node_modules/@softure-ai/blog`, so the computed import fails there. | Accepted: the failure is caught and reported as the existing `blog.indexnow_enqueue_failed` warning (the publish stays written), and the README tells a bundling app to pass `enqueueIndexNow`. |
| 2 | Check | The test must fail without the fix: the refusing plugin makes the build fail on today's literal import. | No change. |
| 3 | Check | `hasBlogIndexNowQueue` stays a static import; `queue.ts` imports only core. | No change. |
| 4 | Minor | The computed specifier needs bundler hints so Vite and webpack do not warn. | Covered in Phase 2 step 2. |

No Critical findings.
