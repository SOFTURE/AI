# Plan: marketing-kit-signed-in-shots

Input: change.md (research and framing skipped, reasons there). Complexity: medium (three phases).

## Today (master `c323892`)

- **Session.** A `screenshots[]` entry takes `storageState` (a file relative to `marketing.json`), checked by
  `findStorageStateProblem` before the browser starts (`src/screenshot/storage-state.ts`, `src/cli/main.ts`
  `resolveStorageStates`). Nothing in the config signs in; the file comes from the app's own script.
- **Phrase.** `expect` is a fixed string; `waitForPhrase` polls `body.innerText` for 5 s with `containsPhrase`
  (`src/film.ts`), so hidden elements do not count.
- **Gates.** `SCREENSHOT_GATES = load, status, scroll, phrase, size` (`src/screenshot/gates.ts`). Each shot is
  judged alone; nothing compares the files of a run.
- **Framing.** `full` (whole page, scrolled first) or the viewport, optionally at `scrollTo`. No element clip.
- **Locators.** Beat `actions` use `locatorSchema` (`src/config/actions-schema.ts`) and `getLocator`
  (`src/record/actions.ts`, which also imports the recorder's `ScreenGuardError`).
- **Config check.** `marketingSchema.superRefine` checks cross-field rules with paths; every key needs a
  `.describe()` (`tests/schema.test.ts`); `schema/marketing.schema.json` is generated (`npm run schema`).
- **Adopting app's generator.** Signs in with a fresh account, runs its seed script for that account, reads a
  position name from the database and checks it is visible, opens `<details>`, captures 358×298 CSS px from a card's
  top at scale 2 (≈6:5), checks the PNG's dimensions and a lower size floor, and refuses identical file sizes.

## Goal

`@softure-ai/marketing-kit` 0.1.10 with all four points of #253; a 0.1.9 `marketing.json` works as it is.

**Out of scope:** signing in for `shots --page` (it targets any origin; `--auth` stays its way); editing the page's
DOM beyond steps (hiding parts of a card stays `app.hideSelectors`); a registration flow beyond what steps on the
sign-in page express (the preparation command creates the account).

## Key decisions

- **Sign-in (1):** new optional top-level `signIn`:
  `{ prepare?: string[], path: "/login", steps: ShotStep[] (≥1), expect: string }`. `shots` signs in once per run,
  before the first entry with `signedIn: true`: a fresh browser context with the run's locale and timezone, `goto
  path`, the steps, then `expect` must show within 15 s; the context's storage state is kept in memory (never
  written to disk) and handed to each signed-in shot's context. A failed sign-in refuses every signed-in shot with
  gate `sign-in` (the others still run). The wait for `expect` retries through the navigation the submit starts
  (a destroyed execution context is a wait, not an error), and the stored state must hold at least one cookie or
  origin entry, else `sign-in` refuses with "no session" (a phrase the login page shows too must not pass).
  Preparation runs only when a selected entry is `signedIn` or uses `{data:…}`; sign-in only when one is
  `signedIn`. `storageState` carries no `sessionStorage` (README). Entry key `signedIn: boolean` (default `false`); with `storageState`,
  refused; without a `signIn` block, refused by the config check.
- **Steps:** `ShotStep` = `fill` (target, value), `click` (target), `check` (target), `press` (key, on the focused
  element). Targets are `locatorSchema` descriptors. Each step has 10 s. Entries take `steps` too (default `[]`),
  run after the page loaded and before any gate reads it (e.g. open a `<details>`); a failing entry step refuses
  the shot with gate `steps`, naming `steps[i] (<do>)`. Error messages never carry a step's `value`.
  `getLocator` moves to `src/record/locator.ts` (re-exported from `actions.ts`), so the screenshot code does not
  import the recorder.
- **Phrase from data (2):** placeholders `{data:<key>}` and `{env:<NAME>}` in `signIn.steps[].value`,
  `signIn.expect`, entries' `path` (URL-encoded), `expect` and `steps[].value`. `signIn.prepare` is a command
  (arguments, no shell) run in the folder of `marketing.json` after the app answers, with `MARKETING_BASE_URL` in
  its environment; its stdout's last non-empty line must be a JSON object of string or number values: the `data`.
  Values are the text as the page shows it (the kit formats nothing; numbers are stringified as is).
  Its stdout is not echoed (it may hold a password); stderr is. A `{data:…}` placeholder without `signIn.prepare`
  is a config error; a key the output lacks, or an unset variable, stops `shots` before the browser starts, naming
  the key and where it is used. Pure resolver `src/screenshot/placeholders.ts`; runner `src/screenshot/prepare.ts`.
- **Frames differ (3):** `takeScreenshots` hashes (SHA-256) every kept file; a later file with the bytes of an
  earlier one is deleted and refused with gate `duplicate`, naming the earlier file. Applies across all files of a
  run, colour-scheme pairs included (identical light and dark files mean the scheme did nothing).
- **Crop (4):** entry key `crop: { target: locator, aspect: "W:H", padding?: 0-200 (default 0) }`. Not with `full`
  or `scrollTo`. The target must match exactly one element (gate `crop` otherwise, `nth` picks one). The frame:
  `x = left - padding`, `y = top - padding`, `width = element width + 2 × padding`, `height = width × H / W`, in
  document coordinates, rounded to whole CSS pixels; captured with `fullPage` plus `clip`, so sticky headers stay at
  the page's top instead of over the element. A frame past the page's edges is refused (gate `crop`, by how many
  px). After capture, the PNG's width and height must be the frame × `scale` (±1 px), else gate `crop`.
- **Gates order:** load, status, steps, scroll, phrase, crop, size, duplicate. `sign-in` stands before load.
- **Version:** 0.1.10 (0.1.9 is published). CHANGELOG notes the new keys and the duplicate gate.

## Phases

### Phase 1: config and pure parts (test-first)

- `src/config/shot-steps.ts`: `shotStepSchema`, `cropSchema` (aspect regex `^[1-9]\d{0,3}:[1-9]\d{0,3}$`).
- `src/config/schema.ts`: `signIn`, entries' `signedIn`, `steps`, `crop`; refinements (signedIn without signIn,
  signedIn with storageState, crop with full/scrollTo, `{data:…}` without prepare, unknown placeholder kinds).
- `src/screenshot/placeholders.ts`: `findPlaceholders`, `resolvePlaceholders(text, sources)` → result value.
- `src/screenshot/prepare.ts`: `parsePrepareOutput(stdout)` (pure) and `runPrepare(command, { cwd, env })`.
- `src/screenshot/gates.ts`: new gates and `findCropFrame` / `findDimensionFailure` (pure geometry).
- Tests: config, placeholders, prepare output, crop geometry. Schema regenerated.

Done when: config and unit tests green; `npm run schema` leaves no diff.

### Phase 2: capture

- `src/record/locator.ts` (moved `getLocator`), `src/screenshot/steps.ts` (run steps), `src/screenshot/sign-in.ts`.
- `src/screenshot/screenshot.ts`: steps, crop, duplicate gate, signed-in contexts; `TakeScreenshotsOptions.signIn`.
- `src/cli/main.ts`: prepare after the server answers, resolve placeholders, pass sign-in.
- Browser tests against the static test server: a login form that sets a cookie, data placeholders, a
  `<details>` step, a 4:3 crop with dimensions at scale 2, a crop past the page end, an ambiguous target, two
  identical shots, a failed sign-in refusing only signed-in entries. CLI test: a missing env variable and a
  `{data:…}` key the preparation does not print stop the run before the browser.

Done when: browser and CLI tests green (Chromium present), each new gate seen red in a test.

### Phase 3: docs and version

- README (Screenshots section, gates table, config table), CHANGELOG 0.1.10, package version 0.1.10, fixture
  example untouched unless a test needs it.

Done when: typecheck, lint, test, build green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: config and pure parts

- [x] config keys and refinements with tests — bbe0ef7
- [x] placeholders, prepare output and crop geometry with tests — bbe0ef7

### Phase 2: capture

- [x] steps, sign-in, crop and duplicate gate in the capture with browser tests — a1a0318
- [x] CLI prepare and placeholder resolution with tests — a1a0318, probe fix 3b3395b

### Phase 3: docs and version

- [x] README, CHANGELOG, version 0.1.10 — 3b3395b
- [x] gates green — 3b3395b (typecheck, lint, build; npm test 5101 passed after the options test fix, browser tests with PLAYWRIGHT_CHROMIUM_PATH)
