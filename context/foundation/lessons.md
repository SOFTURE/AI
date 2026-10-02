# Lessons

Rules distilled from real mistakes in this repository. Each entry is `## L-NNN: <rule>` with **Why**, **How to apply** and **Applies to** (see `WORKFLOW.md` §7 in `@softure-ai/skills`).

## L-001: Build every package with `tsc`, never with a bundler, while it can ship `"use client"` or `"use server"` files
**Why:** FD-1 (`monorepo-tooling`, 2026-10-02) measured tsup 8.5.1 merging a `"use client"` file and a `"use server"` file into one bundle with both directives gone and no warning; Next.js server actions shipped from packages (docs/02 §8) depend on them. The Outcome named tsup; the frame switched to `tsc`.
**How to apply:** a package's `build` script starts with `tsc -p tsconfig.build.json` (CSS steps may follow with `&&`); `tests/repo/packages.test.ts` enforces it for every workspace package and checks that the template's `next/actions.js` still starts with `"use server"`. A single-file bundle for a CLI or a container step (esbuild) is fine only for code that never carries a directive, and it is an extra output, not the package build.
**Applies to:** `foundation/*`, `modules/*`, `tools/*` package builds; `package.json` build scripts; plan, implement and impl-review of any change that adds or changes a build step.

## L-002: Import Next.js modules by their bare specifiers in package code, typed through a declaration file
**Why:** ID-3 (`auth-core`, 2026-10-02) imported `next/navigation.js` and `next/headers.js`, the form NodeNext resolution accepts (Next has no `exports` map). Unit tests and `tsc` passed, but `next build` of the example app failed while collecting a route handler: Next aliases only the bare `next/navigation` per runtime, and the `.js` form reached a vendored context file that is not on disk (`MODULE_UNPARSABLE`).
**How to apply:** in `src/next/`, write `import { redirect } from "next/navigation"`; give the bare specifiers their types with an ambient `src/next/next-modules.d.ts` (`declare module "next/navigation" { export * from "next/navigation.js"; }`). Prove any new Next import through the example app's `next build`, not through `tsc` alone.
**Applies to:** every module's Next adapter (`modules/*/src/next/`), plan and impl-review of changes that add one.
