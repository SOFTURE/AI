# Research: testing-playwright-helpers

Date: 2026-10-05

## Source: FIRE_TRACKER `integration/infrastructure/` (read only, cloned for this change)

| File | Lines | Generic? | What happens to it |
| --- | --- | --- | --- |
| `wait-for.ts` | 43 | yes | ported as `waitFor(probe, { description, timeoutMs, intervalMs })`: polls, keeps the last error as `cause` |
| `select.ts` | 41 | yes | ported: `selectField`, `chooseOption`, `selectedValue`; the markup is the same in `@softure-ai/ui` `Select` (`role="combobox"`, options with `data-value`, hidden input with `name`), which was ported from FIRE |
| `list-row.ts` | 15 | yes | ported as `listRow`: an `li` that is not a select option |
| `links.ts` | 40 | yes | ported as `followLink(page, link, { expectedOrigin })`: a link that leads to another host in a production image is checked and followed on the stack, not clicked |
| `assertions.ts` | 35 | yes | ported: `expectFieldAbsent`, `expectFieldPresent` |
| `factories.ts` | 25 | yes | ported as `uniqueName`; FIRE's own note says the typed factories were dropped because nobody called them |
| `auth.ts` | 256 | partly | the form login is generic; FIRE's account-in-SQL depends on its own users table and scrypt layout. Here: `registerAccount`, `logIn`, `submitLogin` driven by auth's copy; an SQL account factory belongs to `@softure-ai/auth` (gap) |
| `database.ts` | 60 | no | raw `pg` against FIRE's stack; SOFTURE apps already have `@softure-ai/db` (`createDatabase`). Here: `withDatabase(open, work)` opens, works, closes |
| `environment.ts` | 78 | no | FIRE's ports, hosts and accounts |
| `add-form.ts`, `config-section.ts` | 115 | no | FIRE screens |
| `snapshot-form.ts` | 64 | no | stays in FIRE (roadmap) |

FIRE's comments are Polish; the copy is translated.

## The example app's e2e (`examples/next-app/e2e/`, 27 specs)

- The client address `198.18.0.0/15` is built inline or by a local `randomAddress()` in 23 specs.
- `register(page, email)` through `/register` is written out in 12 specs, `logIn` in 5.
- `newEmail()` with `randomUUID()` and a local list of created addresses in 14 specs.
- `expect.poll` then a second read to get the value in `auth-reset`, `auth-reset-mail`, `waitlist`.
- `expect((await page.goto(path))?.status()).toBe(n)` in 3 specs.
- No spec uses the `ui` `Select` (the example has no select), so `chooseOption` is exercised by the
  package's browser tests only.

## The roadmap's unknown: factories here or in each module

Each module's own `testing` export. A factory that writes a module's rows must know its schema and its
invariants (auth's password hash parameters, billing's entitlement rows); putting it in a foundation
package would make `@softure-ai/testing` depend on every module. `@softure-ai/mailing/testing`
(`readMailOutbox`) is the precedent. This package keeps the generic part: unique names and
`withDatabase`. The auth account factory (`@softure-ai/auth/testing`, an account inserted with
`hashPassword`) is recorded as a gap: it changes a published package.

## Repository fit

- Browser tests in Vitest exist already (`tools/marketing-kit/tests/chromium.ts`): CI sets
  `PLAYWRIGHT_CHROMIUM_PATH`; without a browser the tests skip, a configured path that is missing fails.
- `@playwright/test` is an optional peer dependency (an app that only uses the clock shift does not need
  it) and a dev dependency for the package's own tests.
- `expect` from `@playwright/test` works outside the Playwright runner (checked in the tests), so the
  helpers can be tested from Vitest against a real page.
- The example installs packed packages (`file:` links, `install-links`); adding `@softure-ai/testing`
  as a dev dependency packs `dist/`, built by `npm run build` before the e2e (`scripts/e2e.mjs`, CI).
