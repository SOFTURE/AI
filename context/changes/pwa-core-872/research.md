---
change_id: pwa-core-872
---

# Research: the pwa package (issue #872)

## What exists

- `themes/theme-kit/src/next/draw-app-icon.tsx` (#854): `drawAppIcon({ theme, icon, size, tone, shape, scheme })`
  returns a `next/og` `ImageResponse`; shapes `rounded`, `square` (apple icon), `maskable` (glyph inside the safe
  zone); size constants for 32, 180, 192 and 512. `getThemeColor(theme, role, scheme)` reads a token's value (an
  installer reads the manifest outside the page, so values, not CSS variables).
- `modules/seo` is the closest shape: a module without tables whose `/next` entry holds route handlers an app
  re-exports one line each, tested by calling the handlers and reading the `Response`.
- `templates/package/` plus `tests/repo/packages.test.ts`: a package under `modules/` needs `module.json` (id = folder),
  the twelve README sections, `CHANGELOG.md` with `## Unreleased`, exports ordered source/types/default, English as the
  only built-in dictionary. ESLint forbids `next/*` outside `src/next/`.
- `themes/theme-kit/src/react/use-is-mobile.ts`: the `useSyncExternalStore` pattern with a server snapshot.
- Hooks and DOM tests run under `// @vitest-environment happy-dom` (modules/auth).
- Next 16 route handlers: `context.params` is a promise; `generateStaticParams` prerenders a dynamic route handler at
  build; segment config (`dynamicParams`) must be a literal export in the route file, so the app writes
  `export const dynamicParams = false` itself and the handler answers 404 for a name outside the registry too.

## Options

1. A module `modules/pwa` (no tables, no `defineModule` config: every factory takes its options), entries `.`
   (registry, manifest builder, messages), `/next` (route factories, build version), `/worker` (the worker function,
   its config type and the source builder), `/react` (`watchServiceWorker`, `useServiceWorkerUpdate`, `useIsOnline`).
   The prompt is a theme-notion composition (`UpdatePrompt`) taking its copy as props. Chosen.
2. A slot-based prompt inside the pwa package: it would need its own styles outside any theme. Rejected: the theme
   packages own the look, and the issue names them first.
3. Generating the worker with a bundler (Workbox, Serwist): a build step and a dependency per app, and the issue asks
   for one Node-testable function. Rejected.

## Risks

- `Function.prototype.toString` of the worker function after a consumer's build: it must stay self-contained (no
  imports, no helpers from outside its body). The tests run the generated source through `new Function` from the
  built `dist/` file as well as from `src/`.
