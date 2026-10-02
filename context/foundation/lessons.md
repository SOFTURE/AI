# Lessons

Rules distilled from real mistakes in this repository. Each entry is `## L-NNN: <rule>` with **Why**, **How to apply** and **Applies to** (see `WORKFLOW.md` §7 in `@softure-ai/skills`).

## L-001: Build every package with `tsc`, never with a bundler, while it can ship `"use client"` or `"use server"` files
**Why:** FD-1 (`monorepo-tooling`, 2026-10-02) measured tsup 8.5.1 merging a `"use client"` file and a `"use server"` file into one bundle with both directives gone and no warning; Next.js server actions shipped from packages (docs/02 §8) depend on them. The Outcome named tsup; the frame switched to `tsc`.
**How to apply:** a package's `build` script starts with `tsc -p tsconfig.build.json` (CSS steps may follow with `&&`); `tests/repo/packages.test.ts` enforces it for every workspace package and checks that the template's `next/actions.js` still starts with `"use server"`. A single-file bundle for a CLI or a container step (esbuild) is fine only for code that never carries a directive, and it is an extra output, not the package build.
**Applies to:** `foundation/*`, `modules/*`, `tools/*` package builds; `package.json` build scripts; plan, implement and impl-review of any change that adds or changes a build step.
