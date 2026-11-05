# Implementation review: deps-security-audit-2026-11

Verdict: approved.

- Manifests: root devDependencies (`next`, `happy-dom`, `vite`) and `overrides` (`fflate`, `minimatch`), the example
  app's pinned `next`, the blog's `markdown-it` floor; both lockfiles regenerated. `npm audit` reports 0 in both trees.
- Published packages that change: `@softure-ai/blog` (manifest, types) and `@softure-ai/analytics` (message fix);
  both carry an `## Unreleased` changelog entry and ride the next combined release. Module `next` peer ranges stay
  `^16.0.0`; the blog changelog tells apps to update `next` to 16.4.1+.
- The footnote declaration is ambient and compile-time only; the blog's emitted `.d.ts` files do not reference it
  (`npm run build` green).
- The analytics bound moved into `superRefine` with the same path and message; `legacy-params.test.ts` covers it and
  failed on zod 4.6.7 before the fix.
- `fflate` and `minimatch` overrides apply only inside this repository; an app installing `@softure-ai/marketing-kit`
  still gets satori's exact `fflate` 0.7.3 (moderate, ZIP64 parsing of font archives). Named in issue #1101.
