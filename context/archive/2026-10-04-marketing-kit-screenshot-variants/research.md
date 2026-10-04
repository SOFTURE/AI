# Research: marketing-kit-screenshot-variants

Input: change.md, roadmap FU-18. Depth: quick (one package module and its config section, no data).
Snapshot: 8fd54cf (master, after FU-16), 2026-10-04.

## Summary
- `takeScreenshots` (`tools/marketing-kit/src/screenshot/screenshot.ts`) opens one browser context per entry with
  `viewport`, `colorScheme` (one value from `app.colorScheme`, passed by the CLI as `browser.colorScheme`), `locale`,
  `timezoneId` and `reducedMotion`; the file is `getScreenshotFile(outDir, id)` = `<outDir>/<id>.png`.
- Playwright sets the device scale per context (`browser.newContext({ deviceScaleFactor })`); `page.screenshot`
  then writes `width × scale` by `height × scale` pixels (full page: page height × scale). The colour scheme is also
  per context, so a scheme list means one context per scheme, the same loop body as today.
- The gates run per captured file (`takeOne` → `captureLoadedPage`): status, phrase, size. They need no change;
  only the loop over entries becomes a loop over (entry, scheme) shots.
- Answer to the Unknown: keep `minBytes` as an explicit per-file floor that does not scale. A PNG at scale 2 has
  four times the pixels and is larger than the same page at scale 1, so the 40 kB default only gets safer; scaling
  it implicitly would refuse plain pages at scale 2 that pass at scale 1 for no visible reason, and a project that
  wants a stricter floor sets `minBytes`.
- File names: the roadmap fixes `<id>-light.png` / `<id>-dark.png` for a pair. An entry without a scheme list keeps
  `<id>.png` in `app.colorScheme`, so existing configs and the fixture CLI test (`calculator.png`) are unchanged.

## Current state
- Schema: `screenshotSchema` (`src/config/schema.ts:389-398`): `id`, `path`, `width`, `height`, `full`, `expect`,
  `motion`, `minBytes`; strict object; ids unique (`checkUnique("screenshots")`, `schema.ts:530-538`).
- `config.ts:213` passes `data.screenshots` through unchanged; `ScreenshotEntry = MarketingJson["screenshots"][number]`.
- CLI (`src/cli/main.ts:147-178`): `shots` selects entries by id, prints `✓ <file>` / `✗ <id>: <message>`, exits 1
  when any result failed.
- `app.device.scale` (`schema.ts:170`) is the recording's device scale (1-4) and is the description to imitate.
- Tests: `tests/screenshot.test.ts` (static pages served locally; `fixtures/screenshots/motion.html` prints
  "Scheme dark"/"Scheme light" from `prefers-color-scheme`), `tests/shots-cli.test.ts` (fixture project via tsx),
  `tests/config.test.ts`, `tests/schema.test.ts` (drift and descriptions).

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| Config schema | `tools/marketing-kit/src/config/schema.ts` | `scale`, `colorSchemes`, unique file names |
| Capture | `tools/marketing-kit/src/screenshot/screenshot.ts` | one context per shot with `deviceScaleFactor`, shot names |
| CLI | `tools/marketing-kit/src/cli/main.ts` | report each file by its name |
| Exports | `tools/marketing-kit/src/index.ts` | the shot helper |
| Generated | `tools/marketing-kit/schema/marketing.schema.json` | regenerated |
| Docs | `tools/marketing-kit/README.md` | Screenshots section, config table, Limitations |

## Risks
- Name clash: an entry `hero` with both schemes writes `hero-dark.png`, which another entry with id `hero-dark` would
  also write. The schema must refuse it on a path.
- Stale files: switching an entry from one file to a pair would leave the old `<id>.png` looking fresh; removing every
  file the entry could have written before capturing keeps the MK-4 rule "a failed entry leaves no file".
- Very large captures (8000 px × 4) are slow and big; bounded by the existing `pixels(8000)` and `scale` max 4, as
  for the recording device. Not a correctness risk.
