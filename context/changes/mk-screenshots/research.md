# Research: mk-screenshots

Input: [`change.md`](change.md), [`backlog-input.md`](backlog-input.md). Sources: `tools/marketing-kit/`
on master (e15e5c5, MK-2 merged), `docs/03-marketing-kit.md`, PRD FR-25, the MK-2 archive.

## Summary

- The `screenshots[]` contract already exists and covers the whole outcome: `id`, `path`, `width`,
  `height`, `full` (false), `expect`, `motion` (`reduce` | `no-preference`, default `reduce`),
  `minBytes` (40000), with unique ids (`src/config/schema.ts:239-251`, `:286-295`). No schema change is
  needed, so the generated `marketing.schema.json` (a conflict hotspot with MK-3/6/7) stays untouched.
- No command reads it. The CLI (`src/cli/options.ts`) requires a film id for every command, so `shots`
  needs its own branch in argument parsing.
- The app-start helper `ensureServer` (`src/cli/server.ts`) needs only `url` and `ownUrl` from the
  video. Narrowing its parameter to `{ url, ownUrl }` lets `shots` reuse it unchanged: this answers the
  roadmap's unknown with "yes, the shared helper is enough".
- The recorder's browser setup (`src/record/record.ts:109-127`: colour scheme, locale, timezone, one
  style tag per hidden selector, `document.fonts.ready`) is what a screenshot needs too. `src/record/`
  belongs to MK-3, so the screenshot module repeats the few lines instead of importing or moving them.
- `containsPhrase` (`src/film.ts:135`) is the phrase test the screen guard already uses (whole words,
  any whitespace); the expected-phrase gate reuses it.

## Current state

- `marketing.json` → `loadMarketingConfig` → `MarketingConfig.screenshots` (`src/config/config.ts:84,192`),
  the parsed entries as they are (paths are page paths, not files).
- `app.baseUrl`, `app.port`, `app.startCommand`, `app.colorScheme`, `app.hideSelectors` are resolved
  in `config.app`; `brand.locale`, `brand.timezone` in `config.brand`; `output.dir` is absolute.
- `cli/main.ts` dispatches `all | voice | record | render | preview | posts`, every one after
  `loadFilm`. Failures go through `fail(message, exitCode)` (`cli/failure.ts`), printed as one line.
- Playwright 1.63 (`reducedMotion: "reduce" | "no-preference"` is a context option). The recorder uses
  `PLAYWRIGHT_CHROMIUM_PATH` or Playwright's own Chromium.

### FIRE baseline

FIRE_TRACKER's `scripts/screenshot.mts` is not reachable from this session (the repository is outside
the session's GitHub scope and an anonymous clone is refused). The baseline comes from the roadmap item,
`docs/03-marketing-kit.md` §"What FIRE has" ("Playwright with gates: HTTP < 400, a required phrase, file
≥ 40 kB, `--full` scrolls to load lazy images; flag names need translating") and the MK-2 schema, which
was drafted from the same source. Every gate is named there; nothing depends on reading the script.

## Affected surface

| Path | Change |
| --- | --- |
| `tools/marketing-kit/src/screenshot/` (new, owned) | the capture, the gates, the lazy-load scroll |
| `tools/marketing-kit/src/cli/options.ts`, `main.ts` | the `shots [<id>]` command and its flags |
| `tools/marketing-kit/src/cli/server.ts` | parameter type narrowed to `{ url, ownUrl }` |
| `tools/marketing-kit/src/index.ts` | export the screenshot API |
| `tools/marketing-kit/examples/fixture/` | one `screenshots` entry |
| `tools/marketing-kit/tests/` | gate tests against a static page; CLI options |
| `tools/marketing-kit/README.md` | command, gates, limitations |
| `.github/workflows/ci.yml` | a Chromium for the browser tests in the `test` job |

## Tests

- Unit tests run in the CI `test` job, which has no Playwright browser today. The opt-in render test
  (`MARKETING_KIT_RENDER=1`) is the only browser test in the package, and it is not in CI (FU-13).
- GitHub's `ubuntu-latest` image ships Google Chrome at `/usr/bin/google-chrome`; Playwright's
  `chromium.launch({ executablePath })` drives it. Setting `PLAYWRIGHT_CHROMIUM_PATH` on the `test` job
  puts the gate tests in CI without a browser download. Locally:
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- The fixture app (`examples/fixture/app/serve.mjs`) is a static server started through
  `app.startCommand`: the CLI path can be exercised end to end with it.

## Patterns to follow

- Expected failures as values: a discriminated union per screenshot (`ok` / failed gate with a message),
  the CLI turns failures into exit code 1 (AGENTS.md "Errors").
- Messages name the operation and the input (`landing: HTTP 404 from http://…/x`).
- The architecture test forbids fixed colour schemes, locales, zones and viewports in `src/`; every
  browser setting comes from the config.

## Risks

- A PNG of a plain page can be smaller than 40 kB; tests set `minBytes` explicitly so the size gate is
  tested both ways and does not depend on font rendering.
- Chrome stable vs Playwright's Chromium: screenshots and `reducedMotion` emulation work in both
  (CDP); only the opt-in render depends on Playwright's build.

## Answers to unknowns

- **Shared app-start helper:** enough. `ensureServer` only reads `url` and `ownUrl`; `shots` passes the
  first selected screenshot's URL pair and resolves every other path against the address it returns.

## Open questions

None.
