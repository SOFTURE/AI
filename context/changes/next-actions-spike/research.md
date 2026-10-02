# Research: next-actions-spike

Input: change.md, backlog-input.md (roadmap identity ID-1), `context/backlog/next-integration.md`,
research.sources (`docs/`, `../../FIRE_TRACKER/`). Depth: normal.
Snapshot: 1cc9e98 on claude/id-1-next-actions-spike-4b8sg6, 2026-10-02 17:50 Europe/Warsaw.
Method: one researcher, no subagents. Every unknown was settled by measurement: a spike package
(`spikes/next-actions/`, built with tsc like every package) mounted in `examples/next-app` (Next 16.3.8,
Turbopack), served by `next dev` and `next build && next start` against local Postgres 16, driven by
Playwright Chromium and curl. FIRE_TRACKER ships all its actions from the app itself, so it has no
precedent for package-shipped actions.

## Summary

Package-shipped server actions, route handlers and server component pages work in Next 16 without
`transpilePackages`, from a packed copy and from a workspace link, in dev and in production. The
config registry of `@softure-ai/core/next` is visible in all three. The fallbacks named by the
roadmap are not needed. Two rules matter for every module: bound action arguments are plain text
the client can change, and action IDs differ between builds unless `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
is set. The Turbopack migrations bug reproduces from `node_modules` and a core helper fixes it.

## Answers to the unknowns

1. **Does Next 16 bundle `"use server"` files from `node_modules` without `transpilePackages`?** Yes.
   tsc keeps the directive (`spikes/next-actions/dist/next/actions.js:1`). `next build` lists the
   action in `.next/server/server-reference-manifest.json`; the page renders the progressive form
   with the action id; a click in Chromium returns the action's result, and a JavaScript-free form
   POST does too. Route handlers re-exported from the package (`export { GET, POST } from …`) and a
   page re-exported as default (`export { NextActionsPage as default } from …`) both build and serve.
2. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and `allowedOrigins` across instances.**
   - Without the key, two builds of the same code give different action ids (measured:
     `70b032aa…` vs `70c37b86…` for `echoAction`); a page from one build cannot reach an instance of
     another. With the key fixed, two clean builds give identical ids (`70c6e40e…` both times).
     Instances started from one build share ids (an action posted to a second `next start` on the
     same `.next` returned 200).
   - Bound arguments (`echoAction.bind(null, "page")`) travel as plain JSON in the form
     (`$ACTION_1:1 = ["page",null]`); a POST with `["tampered",null]` reached the action with
     `tag: "tampered"`. Only closures of inline `"use server"` functions are encrypted.
   - An action POST whose `Origin` differs from `x-forwarded-host` is refused with 500 and
     "Invalid Server Actions request"; package actions are treated like app actions.
3. **Can a registry set in `instrumentation.ts` / `softure.config.ts` be read in a shipped action?**
   Yes: the action, the route handlers and the page all return `appOrigin` and the module ids from
   `getSoftureConfig()`. It is also filled while `next build` prerenders the static page.
4. **What does `next build` look like?** `/spike/next-actions` prerenders as static, the API route
   is dynamic. No duplicate React: the app router aliases `react` to Next's own copy, so even the
   workspace-linked package (resolved from the repository's `node_modules`) hydrates without an
   invalid-hook error.

## Workspace links

`npm install --install-links=false` symlinks the packages to `../../foundation/*` and
`../../spikes/*`. With the example's `turbopack.root` (its own folder) every import of them fails
("Module not found"). With `turbopack.root` at the repository root, build, start and dev all pass.
The example keeps its root on purpose (FD-7: it must only test packed copies).

## Migrations folder under Turbopack

The backlog entry inferred that a module in `node_modules` fails like one in the app. Measured:
`./node_modules/@softure-ai/next-actions/dist/index.js:19:24 Module not found: Can't resolve
'../migrations/'`. A core helper that builds the URL from non-literal arguments,
`resolveMigrationsDir(import.meta.url, "../migrations/")`, passes `next build`, and `softure migrate`
applies the package's migration (`next-actions 1 create_pings`).

## Files this change touches

- `foundation/core/src/module.ts`, `src/index.ts`, `tests/module.test.ts`, `README.md` §3-§5,
  `src/next/registry.ts` (comment: provisional → confirmed).
- `docs/02-module-standard.md` §4 (migrations form), §8 (verdict and rules).
- `spikes/next-actions/` (new private workspace package), root `package.json` workspaces.
- `examples/next-app/`: package.json and lockfile, `softure.config.ts` (one entry), mount files,
  `e2e/next-actions.spec.ts`, `e2e/migrations.spec.ts` (one more ledger row), guestbook module
  (helper instead of the String() workaround), `.gitignore` (`next dev` writes AGENTS.md/CLAUDE.md).

## Risks

- The spike package becomes a workspace package, so the package-shape tests and the release dry
  run cover it; it stays `private`, so no tag can publish it.
- `examples/next-app/e2e/migrations.spec.ts` asserts the exact ledger; every module added to the
  example adds a row there.
