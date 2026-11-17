# Research: example-minimatch-1319

- Alert: Dependabot #42, `minimatch` >= 7.0.0 < 11.0.1, fixed in 11.0.1, location `examples/next-app/package-lock.json`.
- Path: `glob` 13.0.7 (dev, `minimatch ^10.2.2`) → `minimatch` 10.2.6. Only one copy of `minimatch` in the lockfile.
- No `minimatch` 10.x backport exists, so updating `glob` within its range cannot fix it; an override is the only lever.
- Precedent: the root `package.json` overrides `minimatch` to `^11.0.4` and the root suite runs `glob` on it, so
  `glob` 13 works with minimatch 11 (same `minimatch()`/`Minimatch` API; 11 only drops old Node versions).
- The example's CI job (`e2e.yml`) runs `npm ci`, ESLint, `next build` and Playwright for the example, which is the
  evidence for "the example still builds".
