# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/testing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`testing@x.y.z`).

## Unreleased

- The content of 0.4.0, which was never published: its release stopped at the gates (ESLint ran out of memory in
  `release.yml`) before publishing, and a tag is never moved.

## 0.4.0

- Installed app and phone checks in `@softure-ai/testing/playwright` (#875): `emulateInstalledApp` (iOS
  `navigator.standalone` and `display-mode: standalone` in `matchMedia` and same-origin style sheets),
  `emulateSafeAreaInsets` with `IPHONE_SAFE_AREA` and `expectClearOfSafeAreaInsets` (light and dark),
  `throttleLikePhone` with `PHONE_NETWORK_PROFILES` (`FAST_4G`, `SLOW_4G`) and `PHONE_CPU_SLOWDOWN`, `expectLoadWithin`,
  `expectWorksOffline`, and `expectTouchTargets` with `TOUCH_TARGET_PX` and `TAPPABLE_SELECTOR`. The CDP helpers are
  Chromium only. Additive: nothing to migrate.

## 0.3.0

- `fakeFetch` records form bodies (#676): a call whose body is URL-encoded or multipart (a `URLSearchParams` or
  `FormData`, or a string sent with that content type) carries `form`, its fields in order as
  `{ kind: "text", name, value }` or `{ kind: "file", name, fileName, type, size }` (new type `FakeFetchFormField`).
  `body` keeps the encoded text. Additive: other calls have no `form` key.

## 0.2.0

- `fakeFetch(routes)`: a scripted fake `fetch` for code that takes an injected `fetch` (`requestJson`, API
  clients). Routes by method and exact URL or `RegExp`, in order or `repeat`; answers with `json`, `body`, `status`,
  `headers`, `throws` or a `delayMs` that respects `init.signal`; records each call (`method`, `url`, lower-case
  `headers`, `body`, `json`); an unmatched call rejects with its method and URL and fails `expectAllUsed()`, which
  also lists routes that never answered. Additive: an app can replace its own fakes one suite at a time by passing
  `api.fetch` where it passed its fake, and asserting on `api.calls` instead of `mock.calls` (#664).

## 0.1.5

- `createTestDatabaseClient(url, { max? })` in `@softure-ai/testing/playwright`: a raw client on the integration
  database for test setup and checks, with `query` (a failure names the statement and keeps the driver error as
  `cause`), `countRows(table, where?)` (identifiers checked, values bound, `null` as `IS NULL`) and `close`; it fits
  `withDatabase`. `pg` is a new optional peer dependency, loaded only when a client is created (#412).
- `signInPerFile({ copy, email?, password?, registerPath?, loginPath?, landingPath? })`: one account per test file;
  the first `signIn(page)` registers it through the form with `registerAccount`, later ones use `logIn`. An app drops
  its own per-file account helper (#412).
- New entry `@softure-ai/testing/guards/next`: the server-action rules an app kept in its own architecture tests,
  one function each, returning `file:line: message`: `findNonAsyncServerExports`, `findUnguardedRevalidation`,
  `findRequestApisInImplementations`, `findImplementationsWithoutDatabase`, `findClientValueImports`,
  `findErrorDetailsInRedirects`, and `findServerActionProblems` for all six. The layer naming, the database
  handle's name, request-scoped wrappers, import aliases and error parameters are options (#402).
- `stripComments(source, { syntax? })` in `@softure-ai/testing/guards`: comments blanked with line breaks kept,
  strings and URLs untouched (TypeScript is parsed), `#` comments for YAML and shell (#402).
- `collectStringLiterals(files)`: the string literals of plain `.ts` in the shape `findForbiddenPhrases` takes (#402).
- README: `readSourceFiles` reads only `.ts`/`.tsx` without tests by default; pass `include` for other files (#402).

## 0.1.4

- `test` and `expect` from `@softure-ai/testing/playwright`: Playwright's `test` with a `clientAddress` fixture, a
  fresh random address per test that `page`, `context` and `request` send on top of the configured
  `extraHTTPHeaders`, so `@softure-ai/security` rate limit buckets never leak between tests. An app replaces its
  `beforeEach(setExtraHTTPHeaders(clientAddressHeaders()))` with this import (#326).
- `softurePlaywrightUse({ blockHosts?, chromiumPath? })` for `playwright.config.ts`: launches the Chromium in
  `PLAYWRIGHT_CHROMIUM_PATH` and makes the listed hosts (the production domain) unresolvable with
  `--host-resolver-rules`. Also exported: `hostResolverRules` (#326).
- `softureVitestConfig({ timeZone?, inline?, setupFile? })`: the Vitest preset a Next.js app on SOFTURE packages
  copied by hand: `server.deps.inline` for `@softure-ai/*`, `server-only` and `client-only` as empty modules,
  `next/font/google` and `next/font/local` stubs, `pinTestTimeZone` and the clock setup file. Also exported:
  `softureStubsPlugin` (#326).
- New entry `@softure-ai/testing/guards` for architecture tests: `readSourceFiles`, `findRawColors`, `findLines`,
  `readImports`, `collectVisibleTexts`, `findInlineCopy` and `findForbiddenPhrases` (a product vocabulary guard).
  `typescript` and `vitest` are new optional peer dependencies (#326).

## 0.1.3

- The `vitest-setup` file pins the process to a time zone with a negative offset (`America/New_York`), so code that
  forgets an explicit `timeZone` gets a wrong date instead of passing in UTC or the machine's zone. `TEST_TZ` picks
  another zone; an unknown name fails the run. A behaviour change for apps that list the setup file: tests that
  relied on the machine's zone now run in New York (#251).
- `pinTestTimeZone(timeZone?)` for the top of `vitest.config.*`: pins the zone in the main process, so it holds in
  the `threads` and `vmThreads` pools too, where the setup file cannot switch zones and now fails with a message
  naming this fix. Also exported: `pinTimeZone`, `readTestTimeZone`, `DEFAULT_TEST_TIME_ZONE` (#251).

- `registerAccount` ticks the consent box with the new `tickCheckbox`, so a form whose native checkbox is visually
  hidden under a custom box (`sr-only`, `opacity-0`) registers instead of stopping on "intercepts pointer events"
  (#245).
- `tickCheckbox(checkbox, { timeout? })` exported from `@softure-ai/testing/playwright` for an app's own forms: ticks
  the box, leaves a ticked one ticked, fails on a disabled one.

## 0.1.2

- README: `setupFiles` takes the bare specifier `@softure-ai/testing/vitest-setup`.
