# Plan: example-minimatch-1319

## Phases

1. Override: add `overrides.minimatch: "^11.0.4"` to `examples/next-app/package.json`, regenerate the lockfile with
   `npm install --package-lock-only` in `examples/next-app`; evidence: the lockfile diff touches only `minimatch`
   (and its own dependencies), `npm ls minimatch` shows 11.x.

2. Glob (added for #1322): `overrides.glob: "^14.0.2"`; `@opennextjs/cloudflare` imports only `glob` and
   `globSync`, which glob 14 keeps; evidence: `npm audit` 0, `npm run build` and `npm run build:cloudflare` exit 0.

## Acceptance

- `examples/next-app/package-lock.json` resolves `minimatch` >= 11.0.1.
- Local: `npm ci` and `npm run build` in `examples/next-app` after the root build.
- CI green (ci.yml, e2e.yml incl. the example app jobs); after merge Dependabot alert #42 is fixed and issue #1319
  closed.

## Decisions (auto)

- Override instead of a `glob` bump: no `glob` release depends on a fixed minimatch inside a range that would take
  it without an override, and the root already uses the same override.

## Progress

- [x] p1 override and lockfile: 7a985e6, minimatch 11.0.9 (overridden under glob 13.0.7); local `npm ci` + `next build` in examples/next-app exit 0
- [x] p2 glob override: lockfile glob 14.0.6, path-scurry 3.0.0; `npm audit` 0; `npm ci`, `npm run build`, `npm run build:cloudflare` in examples/next-app exit 0
