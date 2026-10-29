# @softure-ai/testing

Test tools shared by SOFTURE apps and modules:

- a Vitest setup file that pins the tests to a time zone with a negative offset, so code that forgets
  an explicit zone fails ([Test time zone](#test-time-zone)), and shifts the test clock to `TEST_TODAY`
  while time keeps running, so date logic can be tested for a day that has not come yet
  ([Clock shift](#clock-shift));
- a Vitest preset with the settings every Next.js app on SOFTURE packages needs
  ([Vitest preset](#vitest-preset));
- Playwright helpers for black-box tests of an app: a `test` with its own client address per test, a
  config preset, client addresses, the auth forms, unique test data, the product select, polling, links
  and assertions ([Playwright helpers](#playwright-helpers));
- a scripted fake `fetch` for code that takes an injected `fetch`, such as `requestJson` from
  `@softure-ai/core` or an API client ([Fake fetch](#fake-fetch));
- source guards for architecture tests: raw colours, inline copy, forbidden phrases, import lists, comment
  stripping and the Next.js server-action rules ([Source guards](#source-guards)).

## Installation

```bash
npm install --save-dev @softure-ai/testing
```

Inside this repository it is a workspace package.

## Test time zone

Code that converts explicitly to UTC or to the app's zone (`Europe/Warsaw`) gives the same result as
code that forgets the zone when the tests run in UTC or on a machine in that zone, so date tests can
pass by construction. In a zone with a negative offset the calendar day differs from UTC and from
European zones late in the evening, so a missing `timeZone` shows up as a wrong date.

The setup file (step 1 of [Clock shift](#clock-shift)) pins the process to `America/New_York`. Another
zone, for a one-off probe:

```bash
TEST_TZ=Europe/Warsaw npm test
```

**Pin it in the config as well.** Node applies `TZ` per process: the setup file can switch the zone in
Vitest's default `forks` pool, but not inside the worker threads of the `threads` and `vmThreads`
pools. There the setup fails with a message that names the fix instead of running in the wrong zone.
Calling `pinTestTimeZone()` at the top of the config pins the zone in the main process before any
worker starts, so it holds in every pool; it also picks the app's own zone when it is given one:

```ts
// vitest.config.mts
import { pinTestTimeZone } from "@softure-ai/testing";

pinTestTimeZone(); // or pinTestTimeZone("Asia/Tokyo"); TEST_TZ from the shell still wins

export default defineConfig({ test: { setupFiles: ["@softure-ai/testing/vitest-setup"] } });
```

The config stores the zone in `TEST_TZ`, where the setup file in each worker finds the same zone. A
name that is not a time zone fails the run: as `TZ` it would fall back to UTC silently.

## Clock shift

Date guards (a limit valid for one year, a price list that ends on a date) fail by design only on the
day their source stops being valid. Shifting the clock shows today what breaks then.

1. List the package's setup file in the Vitest config. `setupFiles` takes a bare package specifier
   as well as a path:

   ```ts
   // vitest.config.mts
   export default defineConfig({ test: { setupFiles: ["@softure-ai/testing/vitest-setup"] } });
   ```

   An app with setup code of its own can import the package from its file instead
   (`import "@softure-ai/testing/vitest-setup";` in `vitest.setup.ts`).

2. Run the tests on another day:

   ```bash
   TEST_TODAY=2027-01-02 npm test
   ```

   An optional script keeps the command short: `"test:at": "sh -c 'TEST_TODAY=$0 vitest run \"$@\"'"`, then
   `npm run test:at -- 2027-01-02`.

Without `TEST_TODAY` (or with it empty) the clock stays real and nothing is printed. With it, the setup
prints `[@softure-ai/testing] test clock shifted to <day> (TEST_TODAY)` on stderr, so a value left in the
shell or in a loaded `.env` cannot shift a normal run silently. A value that is not a real `YYYY-MM-DD`
date fails the run.

**A fixed default day.** An app that wants every run on a known day writes its own setup file with the
same functions:

```ts
// vitest.setup.ts
import { readTestToday, shiftClock } from "@softure-ai/testing";

shiftClock(readTestToday(process.env.TEST_TODAY) ?? "2027-01-02");
```

### How it behaves

- **A shift, not a freeze.** `Date` gets a fixed offset, so timeouts, durations and `setTimeout` work as
  usual. The day starts at noon local time, which keeps the same calendar day in every zone from UTC-11
  to UTC+11.
- **Only "now" moves.** `new Date()`, `Date.now()` and `Date()` are shifted; `new Date(value)`,
  `Date.UTC` and `Date.parse` are unchanged. `instanceof Date` still accepts dates made before the
  shift and by `structuredClone`.
- **With `vi.useFakeTimers()`.** Fake timers start from the shifted now; a test that sets its own time
  (`vi.useFakeTimers({ now })`, `vi.setSystemTime`) gets that time, and `vi.useRealTimers()` gives the
  shifted clock back.
- **Only the JavaScript clock moves.** Postgres (and PGlite) compute `now()` with the real date. A test
  that mixes both clocks, for example a token issued in SQL and checked in JavaScript, can fail under a
  large shift for reasons that say nothing about the date.
- **Module code takes the injected clock.** `@softure-ai/core`'s `Clock` (`systemClock`,
  `createTestClock`) stays the way modules read time ([core README](../core/README.md)); the shift also
  moves `systemClock`, because it reads the global `Date`.

## Vitest preset

A Next.js app on SOFTURE packages needs the same Vitest settings: the packages transformed by Vitest
(they ship ESM that imports `next/*` without extensions), `server-only` loadable outside Next,
`next/font/google` answered without a network, the pinned time zone and the clock setup file.
`softureVitestConfig()` returns them; the app merges its own config on top:

```ts
// vitest.config.mts
import { softureVitestConfig } from "@softure-ai/testing";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  softureVitestConfig(), // or softureVitestConfig({ timeZone: "Asia/Tokyo", inline: ["esm-only-package"] })
  defineConfig({ test: { include: ["tests/**/*.test.{ts,tsx}"] } }),
);
```

- `test.server.deps.inline`: `@softure-ai/*` plus `inline`.
- `server-only` and `client-only` load as empty modules.
- `next/font/google` exports the fonts the importing file names, and `next/font/local` a default loader;
  each font returns `{ className: "font-inter", variable: "font-inter-variable", style: { fontFamily: "'Inter'" } }`.
- `pinTestTimeZone(timeZone)` runs when the config loads ([Test time zone](#test-time-zone)).
- `test.setupFiles`: `@softure-ai/testing/vitest-setup` ([Clock shift](#clock-shift)); `setupFile: false`
  leaves it out for an app that imports it from its own setup file.

`vitest` is an optional peer dependency.

## Fake fetch

Code that calls another service takes an injected `fetch`. `fakeFetch(routes)` answers it from a script and
never reaches the network:

```ts
import { fakeFetch } from "@softure-ai/testing";

const api = fakeFetch([
  { method: "GET", url: "https://api.example.com/v1/items?page=1", json: { items: [], next: null }, headers: { link: '<https://api.example.com/v1/items?page=2>; rel="next"' } },
  { method: "POST", url: /\/v1\/items$/, status: 429, headers: { "retry-after": "30" } },
  { url: "https://api.example.com/v1/down", throws: new TypeError("fetch failed") },
  { url: "https://api.example.com/v1/slow", delayMs: 60_000, repeat: true },
]);

await client({ fetch: api.fetch }).list();
expect(api.calls[0]).toMatchObject({ method: "GET", headers: { authorization: "Bearer t" } });
api.expectAllUsed(); // every scripted answer was used and no call went unanswered
```

- **Routing.** A route matches a method (any letter case; omitted, any method) and an exact URL (compared
  after URL normalisation, so `https://a.example` matches `https://a.example/`) or a `RegExp` tested against
  the full URL. A route answers one call, then is spent; `repeat: true` answers every matching call. For a
  call the first matching route that still answers wins, so routes with the same URL answer in the listed
  order.
- **Answers.** One of `json` (sent with `content-type: application/json` unless `headers` sets one),
  `body` (any `BodyInit`; use a string or bytes on a repeated route, since a stream is read once) or
  `throws` (the call rejects with that error, as a network failure does); with none, an empty body.
  `status` defaults to 200 and must be 200 to 599. Each call gets a fresh `Response`.
- **Delay.** `delayMs` waits before answering. When `init.signal` aborts during the wait (a timeout), the
  call rejects with the signal's reason; an already aborted signal rejects at once.
- **Records.** `api.calls` lists every answered call as `{ method, url, headers, body, json }`: the method
  in upper case, header names in lower case, the body as text (null without one) and parsed as JSON
  (undefined when it is not JSON). A URL-encoded or multipart body (a `URLSearchParams` or `FormData`, or a
  string sent with that content type) adds `form`, its fields in order: `{ kind: "text", name, value }` or
  `{ kind: "file", name, fileName, type, size }`. A `Request` input is read the same way; `init` wins over it.
- **Unmatched calls fail.** A call no route answers rejects with
  `fakeFetch: no scripted answer for <METHOD> <url>` and lands in `api.unmatched`. Code under test may
  catch that rejection (`requestJson` reports it as a network error), so `expectAllUsed()` throws for it
  too, together with every route that never answered.
- **Checked when built.** Two answers on one route, a body with status 204, 205 or 304, a status outside
  200 to 599 or a negative delay throws from `fakeFetch` itself, naming the route.

`api.fetch` fits `typeof fetch` and core's `FetchFunction`. The helper throws plain errors, so it needs no
Vitest at run time.

## API

| Export | What it does |
| --- | --- |
| `softureVitestConfig({ timeZone?, inline?, setupFile? })` | Pins the zone and returns the [Vitest preset](#vitest-preset) config. |
| `softureStubsPlugin()` | Just the Vite plugin with the `server-only` and `next/font` stubs. |
| `@softure-ai/testing/vitest-setup` | Setup entry: pins the zone (`TEST_TZ`, default `America/New_York`), then shifts the clock when `TEST_TODAY` is set. |
| `DEFAULT_TEST_TIME_ZONE` | `"America/New_York"`: the zone tests run in unless `TEST_TZ` names another. |
| `readTestTimeZone(value)` | Returns the zone a `TEST_TZ` value names, or the default for an unset or empty value; throws a `RangeError` for a name that is not a time zone. |
| `pinTimeZone(timeZone)` | Switches the process to the zone through `TZ`; throws when the zone is unknown or the switch did not take effect (a worker thread). |
| `pinTestTimeZone(timeZone?)` | For the Vitest config: pins `TEST_TZ` from the shell, else `timeZone` (default `America/New_York`), stores it in `TEST_TZ` and returns it. |
| `readTestToday(value)` | Returns the day, or null for an unset or empty value; throws a `RangeError` for anything else that is not a real `YYYY-MM-DD` date. |
| `shiftClock(day)` | Moves the global `Date` to noon of `day` and lets it run; shifting again replaces the earlier shift. |
| `restoreClock()` | Puts the real `Date` back; does nothing when the clock is not shifted. |
| `isClockShifted()` | Whether the global `Date` is shifted. |
| `fakeFetch(routes)` | A scripted [fake fetch](#fake-fetch): `{ fetch, calls, unmatched, expectAllUsed }`; throws for a route that cannot be answered as scripted. |
| `FakeFetchRoute`, `FakeFetchCall`, `FakeFetch` | The types of a route, a recorded call and the fake. |

## Playwright helpers

`@softure-ai/testing/playwright`, for the e2e of an app. `@playwright/test` is an optional peer
dependency: an app that only uses the clock shift does not install it.

```ts
import { authMessages } from "@softure-ai/auth";
import { expect, registerAccount, test, uniqueEmail } from "@softure-ai/testing/playwright";

test("a new account lands on its page", async ({ page }) => {
  await registerAccount(page, { copy: authMessages.en, email: uniqueEmail("e2e"), password: "correct horse battery" });
  await expect(page.getByRole("heading")).toBeVisible();
});
```

**A client address per test.** `test` and `expect` from `@softure-ai/testing/playwright` are
Playwright's, with one more fixture: `clientAddress`, a fresh random address per test that `page`,
`context` and `request` send on top of the configured `extraHTTPHeaders`. `@softure-ai/security` keys
rate limits on it, so a test never finds a bucket another test filled. An app that has fixtures of its
own extends this `test` instead of Playwright's, and makes the import a rule with
`@softure-ai/config`'s ESLint preset:

```ts
// eslint.config.mjs
createSoftureEslintConfig({ tsconfigRootDir: import.meta.dirname, fixtures: { module: "@softure-ai/testing/playwright" } });
```

A test that sets `extraHTTPHeaders` itself (`test.use`) keeps its address. A page from
`browser.newContext()` does not get one: `openPageAsNewClient(browser)` opens a second visitor.

**Config preset.** `softurePlaywrightUse({ blockHosts?, chromiumPath? })` returns the `launchOptions` to
spread into `use`: the Chromium in `PLAYWRIGHT_CHROMIUM_PATH` (cloud sessions and CI ship their own)
and hosts the browser must never reach, such as the production domain. A link or a redirect built on
the wrong origin then fails with `ERR_NAME_NOT_RESOLVED` instead of writing to production:

```ts
// playwright.config.ts
use: { ...softurePlaywrightUse({ blockHosts: ["example.com", "*.example.com"] }), baseURL: "http://localhost:3100" },
```

| Export | What it does |
| --- | --- |
| `test`, `expect` | Playwright's, with the `clientAddress` fixture sent by `page`, `context` and `request`. |
| `softurePlaywrightUse({ blockHosts?, chromiumPath? })`, `hostResolverRules(hosts)` | The `use.launchOptions` above, and the Chromium flag that blocks the hosts. |
| `randomClientAddress()`, `clientAddressHeaders(address?)`, `CLIENT_ADDRESS_HEADER` | A random address in 198.18.0.0/15 (reserved for tests) in `cf-connecting-ip`, the header `@softure-ai/security` keys rate limits on, so every test gets its own buckets. |
| `openPageAsNewClient(browser, options?)` | A page in a new context with its own address: a second visitor with no cookies. |
| `registerAccount(page, { copy, email, password, path?, landingPath? })` | Registers through auth's form (consent ticked with `tickCheckbox`) and waits for `/account`. `copy` is `authMessages.<locale>` of `@softure-ai/auth`; `landingPath: null` skips the check. |
| `logIn(page, { copy, email, password, path?, landingPath? })` | Opens `/login`, logs in and waits for `/account`. |
| `signInPerFile({ copy, email?, password?, registerPath?, loginPath?, landingPath? })` | One account per test file: `account.signIn(page)` registers it through the form the first time and logs it in after that. The default `email` is a fresh `uniqueEmail("e2e")` and the password random, so files (and the workers of a `fullyParallel` file) never share an account; a failed registration is retried by the next `signIn`. |
| `tickCheckbox(checkbox, { timeout? })` | Ticks a checkbox and asserts it is checked; a ticked box stays ticked. Works on a native input that is transparent, clipped (`sr-only`) or covered by a custom box, where `locator.check()` stops on "intercepts pointer events"; a disabled box fails. |
| `submitLogin(page, { copy, email, password })` | Fills and submits the login form already on the page and waits for the action's answer; asserts nothing. |
| `uniqueName(prefix)`, `uniqueEmail(prefix, domain?)` | Names no other test, worker or run produces (`example.com` addresses), so cleanup finds exactly its own rows. |
| `withDatabase(open, work)` | Opens a connection (a `@softure-ai/db` `createDatabase` call), runs `work`, closes it whatever happens. |
| `createTestDatabaseClient(url, { max? })` | A raw client on the integration database (a `pg` pool, 2 connections by default): `query(statement, params?)` returns rows and fails with `Test database query failed: <statement>` (the driver error as `cause`); `countRows(table, where?)` counts rows whose columns equal `where` (`null` is `IS NULL`; plain identifiers only, values bound); `close()` ends the pool once. `pg` is an optional peer dependency, loaded only here. |
| `waitFor(probe, { description, timeoutMs?, intervalMs? })` | Polls until `probe` returns a value and returns it; retries through errors; the timeout error names `description` and carries the last error as `cause`. |
| `selectField(scope, name)`, `chooseOption(field, value)`, `readSelectedValue(field)` | The `@softure-ai/ui` `Select` (a combobox button, not a native `<select>`), found by its form field name. |
| `listRow(scope, text)` | A list row that is not an option of an open select with the same text. |
| `followLink(page, link, { expectedOrigin })` | Clicks a link that must stay on the host, or, for an image built with production origins, checks the `href` and opens the same path on the host under test with the page as `Referer`. |
| `readHref(link)` | The `href` of a link; fails naming the link when it has none. |
| `expectPageStatus(page, path, status)` | Opens `path` and checks the document status (a closed page answers 404). |
| `expectFieldPresent(page, name, because)`, `expectFieldAbsent(page, name, because)` | A form field present once, or absent from the DOM (not just hidden: a hidden field is still submitted). |

**A database client and an account per file.** A test that checks what the app wrote opens a raw client next to
the browser; a file whose tests need a signed-in user but are not about registration shares one account:

```ts
import { authMessages } from "@softure-ai/auth";
import { createTestDatabaseClient, expect, signInPerFile, test, withDatabase } from "@softure-ai/testing/playwright";

const account = signInPerFile({ copy: authMessages.en });
const openDatabase = () => createTestDatabaseClient(process.env.DATABASE_URL ?? "");

test("a saved entry is stored once", async ({ page }) => {
  await account.signIn(page);
  // … save the entry through the UI …
  const count = await withDatabase(openDatabase, (db) => db.countRows("app.entries", { author_email: account.email }));
  expect(count).toBe(1);
});
```

**Factories.** Rows that belong to a module (an account, an entitlement) are written by that module's
own `testing` export, which knows its schema and invariants (`@softure-ai/mailing/testing` reads the
fake outbox, for example). This package keeps what every app shares: unique names, `withDatabase` and the raw test database client.

### Installed app and phone checks

An installable app checks what a phone user sees: the app opened from the home screen, the status bar and the home
indicator over the page, a slow network and CPU, no network at all, and controls a finger can hit. The helpers that
need CDP (`emulateSafeAreaInsets`, `throttleLikePhone`) are Chromium only and fail naming the helper on another
browser; the rest work in every browser.

```ts
import {
  emulateInstalledApp,
  emulateSafeAreaInsets,
  expect,
  expectClearOfSafeAreaInsets,
  expectLoadWithin,
  expectTouchTargets,
  expectWorksOffline,
  IPHONE_SAFE_AREA,
  test,
  throttleLikePhone,
} from "@softure-ai/testing/playwright";

test.use({ viewport: IPHONE_SAFE_AREA.viewport, hasTouch: true, isMobile: true });

test.beforeEach(async ({ context, page }) => {
  await emulateInstalledApp(context);
  await emulateSafeAreaInsets(page, IPHONE_SAFE_AREA.insets);
});

test("the installed app keeps its bars clear of the status bar and the home indicator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Install" })).toHaveCount(0);
  await expectClearOfSafeAreaInsets(page.getByRole("navigation").getByRole("link"), IPHONE_SAFE_AREA.insets);
  await expectTouchTargets(page.getByRole("navigation"));
});

test("the start page loads within 3 s on a slow phone", async ({ context, page }) => {
  await throttleLikePhone(context, page, "SLOW_4G");
  await expectLoadWithin(page, "/", 3000);
});

test("the app opens offline", async ({ page }) => {
  await expectWorksOffline(page, { path: "/", answer: page.getByRole("heading", { name: "Today" }) });
  await expectWorksOffline(page, { path: "/", offlinePath: "/never-visited", answer: page.getByText("You are offline") });
});
```

| Export | What it does |
| --- | --- |
| `emulateInstalledApp(contextOrPage)` | An init script: iOS's `navigator.standalone` is `true` and `display-mode` reads `standalone` in `matchMedia` and in same-origin style sheets, added later ones included (Chromium's CDP cannot emulate `display-mode`, so the script rewrites the media conditions; cross-origin sheets keep their own answer). Call it before the page opens. |
| `emulateSafeAreaInsets(page, insets)`, `IPHONE_SAFE_AREA` | Sets `env(safe-area-inset-*)` over CDP (the page needs `viewport-fit=cover`). `IPHONE_SAFE_AREA` is an iPhone in portrait: viewport 390 × 844, insets 47 top and 34 bottom. Chromium only. |
| `expectClearOfSafeAreaInsets(controls, insets, { colorSchemes? })` | No visible element of the locator overlaps an inset band, checked in light and dark by default (the scheme goes back to the context's after). Reads the current scroll position: the fixed bars are what it is for. The failure lists each element, its position, the band and the scheme. |
| `throttleLikePhone(context, page, profile?, { cpuSlowdown? })` | The phone's network (`"SLOW_4G"` by default, `"FAST_4G"` or a `{ latencyMs, downloadThroughput, uploadThroughput }` in bytes per second) and a 4× slower CPU over CDP; returns `{ release() }`. Chromium only. |
| `PHONE_NETWORK_PROFILES`, `PHONE_CPU_SLOWDOWN` | Chrome DevTools' "Fast 4G" and "Slow 4G" presets, and Lighthouse's mid-range phone CPU slowdown (4). |
| `expectLoadWithin(page, path, budgetMs, { event? })` | Opens `path` and asserts navigation timing reached `load` (or `domcontentloaded`) within the budget; returns the measured ms. |
| `expectWorksOffline(page, { path, answer, offlinePath?, timeout? })` | Opens `path`, waits until a service worker controls the page (reloading once for a worker that does not claim its first page), goes offline, reloads (or opens `offlinePath`) and expects `answer` visible; back online whatever happens. |
| `expectTouchTargets(scope, { minSize?, controls? })`, `TOUCH_TARGET_PX`, `TAPPABLE_SELECTOR` | Every visible tappable control (links, buttons, form controls, their ARIA roles) in a page or locator is at least 44 × 44 px, the themes' touch target; `controls` checks a locator of your own. The failure lists each control with its size. |

## Source guards

`@softure-ai/testing/guards`, for the architecture tests of a package or an app: rules no linter states,
checked over the source files. Visible text is read with the TypeScript parser, so `typescript` (an
optional peer dependency) must be installed.

```ts
import { join } from "node:path";
import { collectVisibleTexts, findForbiddenPhrases, findInlineCopy, findRawColors, readSourceFiles } from "@softure-ai/testing/guards";
import { expect, it } from "vitest";

const sources = readSourceFiles(join(import.meta.dirname, "../src"), { dirs: ["ui", "next"] });

it("has no raw colour literal", () => expect(findRawColors(sources)).toEqual([]));
it("has no inline copy", () => expect(findInlineCopy(sources)).toEqual([]));
it("speaks the product's language", () => {
  const texts = collectVisibleTexts(readSourceFiles(join(import.meta.dirname, "../app")));
  expect(findForbiddenPhrases(texts, ["free trial", /\bsubscri/i], { exempt: ["legal/terms.tsx"] })).toEqual([]);
});
```

A failure lists every hit with its file and line, so one run shows all of them.

`readSourceFiles` reads only `.ts` and `.tsx` without tests by default. A guard that moves onto it from
its own walker and used to see `.css`, `.mts` scripts or test files must pass `include` (for example
`/\.(?:tsx?|mts|css)$/`), or it silently checks fewer files than before.

| Export | What it does |
| --- | --- |
| `readSourceFiles(root, { dirs?, include?, skipDirs?, recursive? })` | `{ file, source }` for the `.ts` and `.tsx` files under `root` (or its `dirs`), tests and `node_modules` left out, sorted by path; `file` is relative to `root`. A missing folder throws. |
| `findRawColors(files)`, `RAW_COLOR` | Lines with a hex colour or a CSS colour function, as `file:line: text`. |
| `findLines(files, pattern)` | Lines that match any pattern, in the same form. |
| `readImports(source)` | Module specifiers of static, side-effect, re-export and literal dynamic imports. |
| `collectVisibleTexts(files, { copyAttribute? })` | `{ file, line, attribute, text }` for every JSX text, string child (`{"Save"}`) and literal value of a copy attribute (`DEFAULT_COPY_ATTRIBUTE`: the ARIA texts, `title`, `placeholder`, `alt`, `label`, `*Label`). |
| `findInlineCopy(files, { copyAttribute? })` | The visible texts with a letter: copy written into markup instead of coming from messages or props. |
| `findForbiddenPhrases(texts, phrases, { exempt? })` | The texts that hold a phrase (a string as whole words, ignoring case; a RegExp as written), each with the phrase; `exempt` files by path end or RegExp. |
| `collectStringLiterals(files)` | The string and template literals in code (JSX attribute values too), in the shape of `collectVisibleTexts`, so `findForbiddenPhrases` checks plain `.ts`; module specifiers, directives, literal types and property names left out. |
| `stripComments(source, { syntax? })` | The source with comments blanked to spaces, line breaks kept, so `file:line` stays right. TypeScript is parsed (`tsx` by default, `ts` for `<T>x` casts): `//` in a string, a URL, a regex or JSX text stays. `syntax: "hash"` blanks `#` comments (YAML, shell) outside quotes. |

### Next.js server actions

`@softure-ai/testing/guards/next` checks the rules every Next.js app on SOFTURE packages follows for
server actions. Each rule takes the files from `readSourceFiles` and returns `file:line: message` for
every hit; `findServerActionProblems` runs all six, sorted by file and line.

```ts
import { join } from "node:path";
import { readSourceFiles } from "@softure-ai/testing/guards";
import { findServerActionProblems } from "@softure-ai/testing/guards/next";
import { expect, it } from "vitest";

const sources = readSourceFiles(join(import.meta.dirname, ".."), { dirs: ["app", "lib"] });

it("keeps the server-action rules", () => {
  expect(findServerActionProblems(sources, { aliases: { "@/": "" } })).toEqual([]);
});
```

| Export | Rule |
| --- | --- |
| `findNonAsyncServerExports(files)` | 1. A `"use server"` module exports only async functions (types pass). `export { name }` is checked against the local declaration; a re-export from another module cannot be proven and is reported. |
| `findUnguardedRevalidation(files)` | 2. `revalidatePath` / `revalidateTag` / `updateTag` from `next/cache` run in a success branch: inside an `if`/`else`, a `case`, `?:`, `&&`, `\|\|` or `??`; after an earlier `if` that exits (`return`, `throw`, `redirect()`, `notFound()`); or after an `await` in the same `try` block. Reported before any such check and in `catch` or `finally`. A sync function (a refresh helper) passes; its callers are not followed. |
| `findRequestApisInImplementations(files, { implementation?, requestApis? })` | 3. Implementation modules import no request-scoped API: `cookies`, `headers`, `draftMode` from `next/headers`, `connection` from `next/server` (`DEFAULT_REQUEST_APIS`), plus an app's own wrappers through `requestApis`. |
| `findImplementationsWithoutDatabase(files, { implementation?, databaseName? })` | 4. Every function an implementation module exports takes the database handle (`database` or `db`, `DEFAULT_DATABASE_NAME`) as a parameter, a destructured option, or a member of its options type declared in the same file. |
| `findClientValueImports(files, { implementation?, aliases? })` | 5. No value from a `"use client"` module in server code (`"use server"`, implementation modules, files importing `server-only`); other files without `"use client"` may import components, so there only names that are not component-shaped (`MAX_ITEMS`, `formatDate`) are reported. Type imports pass. Relative specifiers and `aliases` (`{ "@/": "" }`) are resolved among the given files. |
| `findErrorDetailsInRedirects(files, { params? })` | 6. A `redirect` / `permanentRedirect` from `next/navigation` sets no `error`, `message`, `reason` or `details` parameter (`DEFAULT_ERROR_PARAMS`) to free text: a literal that is not code-shaped, or an expression with `.message`, `.stack`, `String(…)`, `JSON.stringify(…)` or `.toString()`. A code from a variable passes. |
| `findServerActionProblems(files, options)` | All six; the options of each rule, with `errorParams` for rule 6. |

`implementation` is a RegExp over `file` that names the layer receiving `database` and `now`; the default
(`DEFAULT_IMPLEMENTATION`) matches files named `do-*` or `manage-*`. The rules read one file's syntax
without types: a call through a variable or a helper in another file is not followed.

## Limitations

- Node only: the setup reads `process.env`.
- The zone is pinned when the setup runs. A module loaded earlier that cached a formatter or a computed
  date keeps what it computed in the earlier zone; `pinTestTimeZone()` in the config avoids that.
- Code that captured `Date` before the setup ran (a module loaded earlier) keeps the real clock.
