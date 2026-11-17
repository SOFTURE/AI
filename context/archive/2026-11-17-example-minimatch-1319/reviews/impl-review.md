# Implementation review: example-minimatch-1319

- Verdict: approved.
- Diff: `examples/next-app/package.json` gains `overrides.minimatch: "^11.0.4"`; the lockfile moves `minimatch`
  10.2.6 → 11.0.9 and adds its new dependency `@isaacs/nonrecursive-glob-match` 1.1.0. Nothing else moves.
- Evidence: `npm ls minimatch` in the example shows `minimatch@11.0.9 overridden` under `glob@13.0.7`; after the root
  build, `npm ci` and `npm run build` in `examples/next-app` exit 0. The Workers build and both e2e suites run in CI.
- Out of scope, noted: `npm audit` in the example still reports GHSA-3g3m-2fjr-6pw4 on `glob` 13 (via
  `@opennextjs/cloudflare`), which has no Dependabot alert yet; it needs `glob` 14, a major bump of that dependency.
