# @softure-ai/testing

Test tools shared by SOFTURE apps and modules:

- a Vitest setup file that shifts the test clock to `TEST_TODAY` while time keeps running, so date
  logic can be tested for a day that has not come yet ([Clock shift](#clock-shift));
- Playwright helpers for black-box tests of an app: client addresses, the auth forms, unique test
  data, the product select, polling, links and assertions ([Playwright helpers](#playwright-helpers)).

## Installation

```bash
npm install --save-dev @softure-ai/testing
```

Inside this repository it is a workspace package.

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

## API

| Export | What it does |
| --- | --- |
| `@softure-ai/testing/vitest-setup` | Setup entry: shifts the clock when `TEST_TODAY` is set. |
| `readTestToday(value)` | Returns the day, or null for an unset or empty value; throws a `RangeError` for anything else that is not a real `YYYY-MM-DD` date. |
| `shiftClock(day)` | Moves the global `Date` to noon of `day` and lets it run; shifting again replaces the earlier shift. |
| `restoreClock()` | Puts the real `Date` back; does nothing when the clock is not shifted. |
| `isClockShifted()` | Whether the global `Date` is shifted. |

## Playwright helpers

`@softure-ai/testing/playwright`, for the e2e of an app. `@playwright/test` is an optional peer
dependency: an app that only uses the clock shift does not install it.

```ts
import { expect, test } from "@playwright/test";
import { authMessages } from "@softure-ai/auth";
import { clientAddressHeaders, registerAccount, uniqueEmail } from "@softure-ai/testing/playwright";

test.beforeEach(({ context }) => context.setExtraHTTPHeaders(clientAddressHeaders()));

test("a new account lands on its page", async ({ page }) => {
  await registerAccount(page, { copy: authMessages.en, email: uniqueEmail("e2e"), password: "correct horse battery" });
  await expect(page.getByRole("heading")).toBeVisible();
});
```

| Export | What it does |
| --- | --- |
| `randomClientAddress()`, `clientAddressHeaders(address?)`, `CLIENT_ADDRESS_HEADER` | A random address in 198.18.0.0/15 (reserved for tests) in `cf-connecting-ip`, the header `@softure-ai/security` keys rate limits on, so every test gets its own buckets. |
| `openPageAsNewClient(browser, options?)` | A page in a new context with its own address: a second visitor with no cookies. |
| `registerAccount(page, { copy, email, password, path?, landingPath? })` | Registers through auth's form (consent ticked) and waits for `/account`. `copy` is `authMessages.<locale>` of `@softure-ai/auth`; `landingPath: null` skips the check. |
| `logIn(page, { copy, email, password, path?, landingPath? })` | Opens `/login`, logs in and waits for `/account`. |
| `submitLogin(page, { copy, email, password })` | Fills and submits the login form already on the page and waits for the action's answer; asserts nothing. |
| `uniqueName(prefix)`, `uniqueEmail(prefix, domain?)` | Names no other test, worker or run produces (`example.com` addresses), so cleanup finds exactly its own rows. |
| `withDatabase(open, work)` | Opens a connection (a `@softure-ai/db` `createDatabase` call), runs `work`, closes it whatever happens. |
| `waitFor(probe, { description, timeoutMs?, intervalMs? })` | Polls until `probe` returns a value and returns it; retries through errors; the timeout error names `description` and carries the last error as `cause`. |
| `selectField(scope, name)`, `chooseOption(field, value)`, `readSelectedValue(field)` | The `@softure-ai/ui` `Select` (a combobox button, not a native `<select>`), found by its form field name. |
| `listRow(scope, text)` | A list row that is not an option of an open select with the same text. |
| `followLink(page, link, { expectedOrigin })` | Clicks a link that must stay on the host, or, for an image built with production origins, checks the `href` and opens the same path on the host under test with the page as `Referer`. |
| `readHref(link)` | The `href` of a link; fails naming the link when it has none. |
| `expectPageStatus(page, path, status)` | Opens `path` and checks the document status (a closed page answers 404). |
| `expectFieldPresent(page, name, because)`, `expectFieldAbsent(page, name, because)` | A form field present once, or absent from the DOM (not just hidden: a hidden field is still submitted). |

**Factories.** Rows that belong to a module (an account, an entitlement) are written by that module's
own `testing` export, which knows its schema and invariants (`@softure-ai/mailing/testing` reads the
fake outbox, for example). This package keeps what every app shares: unique names and `withDatabase`.

## Limitations

- Node only: the setup reads `process.env`.
- Code that captured `Date` before the setup ran (a module loaded earlier) keeps the real clock.
