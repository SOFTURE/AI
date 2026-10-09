# Plan: testing-presets-and-guards

## Approach

1. `src/guards/` (new entry `./guards`): `readSourceFiles`, `findLines`/`findRawColors`/`RAW_COLOR`, `readImports`,
   `collectVisibleTexts`/`findInlineCopy`/`findForbiddenPhrases` on the TypeScript parser. Tests in
   `tests/guards.test.ts`, including the planted cases the ui and charts tests carried.
2. `src/playwright/test.ts`: `test = base.extend({ clientAddress, context, request })`; `context` and `request` add
   the address on top of the resolved `extraHTTPHeaders` option. Test: a real Playwright run of two specs against an
   echo server, asserting the header from `page` and `request`, the config header kept, and two different addresses.
3. `src/playwright/preset.ts`: `softurePlaywrightUse({ blockHosts, chromiumPath })` and `hostResolverRules`. Tests:
   the returned shape, a refused host name, and Chromium failing on a blocked host while reaching another.
4. `src/vitest/preset.ts`: `softureVitestConfig` and `softureStubsPlugin`. Tests: config shape, plugin hooks, and a
   child Vitest run of a small app importing `server-only`, `next/font/google` and `next/font/local`.
5. Rewrite the architecture tests of auth, billing, feature-switches, mailing, mcp-access, privacy, waitlist, blog,
   agent-ready, ui, charts and marketing-kit on the guards. Example app configs use `softurePlaywrightUse()`.
6. README, CHANGELOG `## 0.1.4`, version in `package.json` and `package-lock.json`; docs/02 links the guards.

## Decisions (auto)

- **D1: override `context` and `request`, not the `extraHTTPHeaders` option.** A config or `test.use` value for an
  option replaces a fixture function, which would drop the address. Reading the resolved option and adding the
  header keeps both.
- **D2: one default copy-attribute list,** the blog's (ARIA texts only, not ids and states). It covers what the
  ui test's exclusion set did, without a list of exceptions. String children (`{"Save"}`) now count as copy too.
- **D3: guards as a separate entry,** so `typescript` loads only for architecture tests; `typescript` and `vitest`
  become optional peers.
- **D4: no workspace devDependency** on `@softure-ai/testing` in the packages: their tests already resolve
  repository tools (`typescript`, `vitest`) from the root, and the packages ship no tests.
- **D5: `next/font/google` stub reads the importer's named imports** to export them, since ESM named imports need
  real exports; a font is `{ className, variable, style }` like Next's.
- **D6: patch bump to 0.1.4,** as the repository does for additions.

## Progress

- [x] 1. Guards and tests
- [x] 2. Playwright test fixture and test
- [x] 3. Playwright preset and tests
- [x] 4. Vitest preset and tests
- [x] 5. Architecture tests rewritten, example configs
- [x] 6. Docs, CHANGELOG, version
