---
change_id: pwa-core-872
verdict: approved
---

# Implementation review

Reviewed the diff from 90e8bad against plan.md and issue #872.

- Acceptance of #872, item by item: the `/pwa/` prefix and its paths (`paths.ts`, README §1 and §12); the manifest
  from token values and the app's copy, served as `application/manifest+json`; the icon registry, its route (404
  outside the registry, `generateStaticParams`) and the head's links from the same registry; the worker at `/sw.js`
  with `no-cache` and `Service-Worker-Allowed: /`, generated from one function plus JSON, every listed rule under
  test; the update flow (`updateViaCache: "none"`, no `skipWaiting` at install, reload only after `activate` on
  `controllerchange`, never on the first install, `update()` on return to the foreground, no worker in development,
  a failed registration reported); the build version; `useIsOnline`; the prompt in theme-notion.
- The worker's self-containment is pinned twice: the served text runs in a fresh script, and the file compiled with
  the package's build options runs from its own text.
- The package is a module with an inline manifest (`pwa`), as the release tooling bumps it; the release plan test now
  counts 30 public packages.
- `createServiceWorkerRoute` checks its options when the route module loads, so a wrong option fails the build.
- Added on review: the worker leaves Chrome's `only-if-cached` requests outside `same-origin` mode to the browser
  (fetching them from a worker throws).
- theme-notion: one isolated gallery case (its own visual page), so the full-page baselines do not move; 104 visual
  tests and axe pass; parity fixture regenerated.
- Gates: typecheck, lint and the language gate in pre-commit; full `npm test` green (the one failure seen,
  `deploy-workflows`, was the container missing `ssh-keygen`, not this change).

Verdict: approved, no changes.
