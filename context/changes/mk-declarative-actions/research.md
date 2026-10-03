# Research: mk-declarative-actions

Input: change.md, roadmap MK-3, research.sources (`docs/03-marketing-kit.md`, FIRE_TRACKER `video/**`,
read-only clone at 58e6c84). Depth: normal (no data, no money; the risk is a contract that must express
FIRE's scene without loss). Snapshot: e15e5c5 on claude/project-thread-vfwcqk (master after PR #35),
2026-10-03 19:55 Europe/Warsaw.

## Summary

- The Director has 14 methods (`src/film.ts:93-125`); 13 are actions (`beat` is the frame around them).
  Every argument except the targets is plain data (strings, numbers, booleans, a cue name).
- FIRE's scene (`video/films/ania-calculator.ts:66-177`, 8 beats, 69 actions) uses 12 of the 13 actions
  (`type` only through `fill`) and five Playwright locator shapes, all expressible as data (table below).
- FIRE has **no conditional waits**: every wait is `until(word)` (5) or `hold(seconds)` (10); two local
  helpers (`next()`, `step(n)`) only shorten repeated locators. This answers the first unknown.
- A failing locator today names `String(locator)` and the scene file (`src/record/record.ts:157-164`);
  a JSON action can name its own path (`videos[0].beats[2].actions[4].target`) if the interpreter wraps
  each Director call. This answers the second unknown.
- The recording is deterministic for a given sequence of Director calls (frozen clock, frame-by-frame,
  `record.ts:84-150`), so two scenes that make the same calls with the same locators record the same
  log. A call trace is a faithful, browser-free proxy for the log.
- `ScreenGuardError` drives exit code 2 (`src/cli/main.ts:66-68`); any wrapping must keep the class.

## Current state

- **Scene loading** (`src/cli/films.ts:21-29`): `tsImport(sceneModule)`, `scene` must be a function;
  `findMissingFiles` checks the module exists (`src/config/config.ts:214`).
- **Beat schema** (`src/config/schema.ts:203`): `{ id, text }` strict; `pad` exists only as a TS
  argument (`Director.beat(id, actions, { pad })`).
- **Director** (`src/record/record.ts:228-339`): `bring`/`tap` take one `Locator`; `focus`/`mark` take
  `Locator | Locator[]` (union rectangle); `fill(name, value)` builds `input[name=${name}]` unquoted
  (`record.ts:283`), so the name must be a CSS identifier.
- **Errors**: `failLocator` (`record.ts:157-164`) prints the sentence, the locator and `filmPath`
  (today `sceneModule`); the beat order check and the screen guard name `filmPath` too.
- **Static film checks that run only at the end of a recording** (`record.ts:344-355`): every beat
  recorded, `checkScreen` called, `hook.still` saved, every `hook.shots[].mark` marked. For JSON actions
  all four can be checked when the config loads.

## FIRE's scene, by shape

FIRE's copy is Polish; the strings below are translated (the language gate keeps Polish out of the repository).

| FIRE call | Count | As data |
| --- | --- | --- |
| `page.getByRole("button", { name: /^Next$/ })` | 6 | role + name as a regex |
| `page.getByRole("button", { name: "Clear" })` | 1 | role + name as a string |
| `page.getByText(new RegExp("Step n of 7", "i"))` | 5 | text as a regex with the `i` flag |
| `page.getByText("…", { exact: true }).first()` | 5 | text, `exact`, `nth: 0` |
| `page.getByText("March 2040").first()` | 4 | text, `nth: 0` |
| `page.getByText(/Bridge to retirement/i).first()` | 1 | text as a regex, `nth: 0` |
| `page.locator("label", { hasText: "…" })` | 2 | css + `hasText` |
| `page.getByText("What your life costs")` | 2 | text |

Action counts (`grep -o "await d\.[a-z]*"`): bring 12, wide 10, hold 10, tap 9, focus 7, fill 6,
until 5, blur 4, cue 2, mark 2, still 1, checkScreen 1; `beat` 8 with `pad` on two (0 and 1.4).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Contract | `src/config/schema.ts`, `schema/marketing.schema.json` | `actions`, `pad`, descriptors, static checks |
| Loaded config | `src/config/config.ts` | the scene becomes a union: module or actions |
| Interpreter | `src/record/actions.ts` (new) | descriptor → locator, action → Director call, JSON path in errors |
| Film types | `src/film.ts`, `src/index.ts` | descriptor and action types exported |
| CLI | `src/cli/films.ts`, `src/cli/main.ts` | a video without `sceneModule` gets the action scene |
| Fixture | `examples/fixture/marketing.json` | a JSON twin of `fixture-tour` |
| Tests | `tests/actions.test.ts` (new), `tests/config.test.ts`, `tests/render.test.ts` | |
| Docs | `README.md`, `docs/03-marketing-kit.md` | the actions reference |

## Tests

- No browser in CI (`.github/workflows/ci.yml`), so the interpreter is tested against a fake page that
  records how locators are built and a fake Director that records calls.
- The opt-in render test (`tests/render.test.ts`) can record the JSON twin next to the TS fixture film and
  compare the two `log.json` files with a real Chromium.

## Patterns to follow

- Schema rules: strict objects, refinements with explicit paths (MK-2 plan, "Errors").
- zod 4 plain unions report `invalid_union` with the message "Invalid input" at the union's path (scratch
  run with zod 4.6.5), which does not tell the author which key is wrong; a discriminated union on `do`
  reports "Invalid discriminator value. Expected 'tap' | 'hold'". Descriptors need another shape.
- Playwright's `getByRole` takes a closed list of roles (`playwright-core/types/types.d.ts:3190`); the
  schema can list them and a type test can tie the list to Playwright's type.

## SOFTURE modules

None applies: no module covers browser scripting.

## Open questions

None blocking. FIRE cannot be recorded here (its app needs Postgres in Docker, `package.json` `dev`), so
the FIRE baseline is the call trace (above); the real-browser log comparison runs on the fixture.
