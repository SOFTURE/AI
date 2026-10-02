# @softure-ai/next-actions (spike)

Spike of identity ID-1 (`next-actions-spike`). Private, never published.

It ships what every module's Next.js adapter will ship: a `"use server"` action (`src/next/actions.ts`),
route handlers (`src/next/route.ts`) and a server component page (`src/next/page.tsx`) with a client
form, plus a migration declared through `resolveMigrationsDir`. The example app mounts it
(`examples/next-app/app/spike/`, `app/api/spike/`) and `examples/next-app/e2e/next-actions.spec.ts`
checks it. The verdict it backs is in `docs/02-module-standard.md` §8.

Delete this folder, its mount files and its e2e file once a real module (auth, identity ID-3) covers
the same paths in the example app.
