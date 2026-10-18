---
change_id: mcp-access-server-only-cjs-571
---

# Research: mcp-access-server-only-cjs-571

Sources: `modules/mcp-access/src/stdio/register.ts`, `src/stdio/index.ts`, README "Stdio", the
`adoption-gaps-315.test.ts` stdio test, the published `server-only@0.0.1` tarball, Node 22.22 `module.registerHooks`.

- `register.ts` short-circuits `server-only` to `data:text/javascript,export%20%7B%7D%3B` with `format: "module"`.
  Reproduced on Node 22.22.0: `node --import ./register ./p.cjs` with `require("server-only")` fails with
  `ENOENT … open 'data:text/javascript,…'`; the `.mjs` twin prints `ok`.
- `server-only@0.0.1` ships `index.js` (throws) and `empty.js` (empty, CommonJS: the package has no `type`). Its
  `exports` map is `{ ".": { "react-server": "./empty.js", "default": "./index.js" } }`; `server-only/empty.js` is not
  exported.
- `registerHooks` `resolve` gets `context.conditions` (`require`/`import`, `node`, …) and may call
  `nextResolve(specifier, { ...context, conditions })`. A prototype adding `react-server` resolves the importer's
  installed `server-only` to `empty.js`: `.cjs` require, `.mjs` import and `tsx --import` of a `.ts` file in a
  CommonJS package all print `ok`. The extra condition is only passed for the `server-only` specifier, so nothing
  else changes.
- When `server-only` is not installed `nextResolve` throws `ERR_MODULE_NOT_FOUND`; today's hook still answers it.
- The current test runs `import('server-only')` from `tests/` where `server-only` is not installed (it is not a
  dependency of the monorepo), so it only covers the fallback. A temp fixture with a copy of the real package shape
  can cover the installed case for both loaders.
