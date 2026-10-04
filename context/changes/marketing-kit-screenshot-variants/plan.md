# Plan: marketing-kit-screenshot-variants

Input: change.md, research.md. Complexity: small.

## Goal
A `screenshots[]` entry in `marketing.json` takes `scale` (device pixels per CSS pixel, 1-4, default 1) and
`colorSchemes` (a non-empty list of distinct `light` / `dark`). With `colorSchemes` the entry writes one file per
scheme, `<id>-<scheme>.png`, each captured in its own browser context and each behind the status, phrase and size
gates; without it the entry writes `<id>.png` in `app.colorScheme` as today. `minBytes` applies to every file as
given. The schema refuses two entries that would write the same file.

**Out of scope:** a scale-dependent `minBytes`; schemes or scale for the recording or OG images; other schema keys
(FU-19); publishing.

## Approach
**Starting point:** one context per entry in `takeScreenshots` (research §Summary).

**Chosen:** a pure `getScreenshotShots(entry, defaultScheme)` in `screenshot.ts` returns the entry's shots
(`{ name, scheme }[]`: `[{ name: id, scheme: default }]` without a list, `[{ name: "<id>-<scheme>", scheme }]` per
listed scheme, in list order). `takeScreenshots` removes every file the entry could write (`<id>.png` and both
`<id>-<scheme>.png`) before capturing it, then runs one context per shot with `colorScheme: shot.scheme` and
`deviceScaleFactor: entry.scale`. Each result carries `name` (the file stem) next to `id`; the CLI prints `name`.
The schema's top-level `superRefine` checks that the file names of all entries are unique, using the same helper's
naming (a `getScreenshotNames` that does not need the default scheme).
Rejected: suffixing even without a list (`<id>-light.png` always) - breaks existing configs and output paths for
nothing; a `schemes: "both"` flag - a list says the same and keeps the file order explicit; scaling `minBytes` with
`scale²` (research §Summary, the Unknown).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Key names | `scale`, `colorSchemes` | `scale` matches `app.device.scale`; `colorSchemes` is the plural of `app.colorScheme` | research §Current state |
| Default | `scale: 1`, no `colorSchemes` | unchanged output for every existing config | research §Summary |
| Size gate | `minBytes` per file, not scaled | answers the roadmap Unknown | research §Summary |
| File names | `<id>.png` without a list, `<id>-<scheme>.png` with one | roadmap outcome | roadmap FU-18 |
| Name clash | refused at load, path `screenshots[i].id`, message names the other entry | a silently overwritten PNG is found only by eye | research §Risks |
| Stale files | remove all of an entry's possible files before capture | keeps the MK-4 rule | research §Risks |
| Result shape | `name` added to both result variants | the CLI and callers need the file stem; `id` keeps meaning the entry | plan |
| Version bump | none | the package is unpublished `0.0.0` (MK-8 publishes) | plan |

**Critical details:** removing the possible files of an entry is safe only because the name check guarantees no other
entry owns them. Each new key needs a `.describe()`; regenerate the JSON with `npm run schema -w @softure-ai/marketing-kit`.

## Phase 1: Scale and colour schemes per screenshot
**Discipline:** TDD. **Files:** `tools/marketing-kit/src/config/schema.ts`, `tools/marketing-kit/src/screenshot/screenshot.ts`,
`tools/marketing-kit/src/cli/main.ts`, `tools/marketing-kit/src/index.ts`, `tools/marketing-kit/tests/screenshot.test.ts`,
`tools/marketing-kit/tests/shots-cli.test.ts`, `tools/marketing-kit/tests/config.test.ts`,
`tools/marketing-kit/schema/marketing.schema.json`, `tools/marketing-kit/README.md`

1. Tests first:
   - `screenshot.test.ts`: `getScreenshotShots` without a list (one shot named by id in the default scheme), with
     `["dark", "light"]` (two shots in that order, suffixed names); against the static pages: `scale: 2` writes a PNG
     of 1600×1200 for an 800×600 viewport (IHDR width and height); `colorSchemes: ["light", "dark"]` on
     `motion.html` with `expect: "Scheme dark"` keeps `<id>-dark.png` and refuses `<id>-light.png` on the phrase gate
     (proves each file is captured in its scheme and gated alone); an older `<id>.png` is removed when the entry now
     has a scheme list; existing assertions gain `name`.
   - `config.test.ts`: the defaults case at line 242 gains `scale: 1` and no `colorSchemes` (plan review W1); `scale` and `colorSchemes` load as written; refusals by path:
     `screenshots[0].scale` 0.5 and 5, `screenshots[0].colorSchemes` empty, `screenshots[0].colorSchemes` with a
     duplicate, `screenshots[1].id` when entry `hero` with both schemes and entry `hero-dark` would both write
     `hero-dark.png`.
   - `shots-cli.test.ts`: a copy of the fixture config with `scale: 2` and `colorSchemes: ["light", "dark"]` writes
     `calculator-light.png` and `calculator-dark.png`, each 2560 px wide, and prints a `✓` line per file.
2. `schema.ts`: `scale` and `colorSchemes` on `screenshotSchema` (described; uniqueness of the list as a refine on
   the key); unique file names in the top-level `superRefine`.
3. `screenshot.ts`: `getScreenshotNames`, `getScreenshotShots`, the per-shot loop with `deviceScaleFactor`, stale-file
   removal, `name` on results; module comment updated. `index.ts`: export the helpers. `main.ts`: print `name`.
4. Regenerate `schema/marketing.schema.json`.
5. `README.md`: the Screenshots section (scale, scheme pairs, `minBytes` per file, `shots <id>` takes the entry's id and writes all its files - plan review S1), the config table row, and the
   Limitations line removed.

**Done when:**
- Automated: the new and updated tests in `screenshot.test.ts`, `config.test.ts` and `shots-cli.test.ts` pass with a local Chromium.
- Automated: `tests/schema.test.ts` passes on the regenerated file (drift and descriptions).
- Automated: Gates green (typecheck, lint, test) and `npm run build`.
- Manual: owner opens a light/dark pair at scale 2 and finds both sharp and in the right scheme.

## Risks and rollback
- A project relying on the result shape (`id` only) still works: `name` is added, nothing removed.
- Rollback: revert the phase commit; configs without the new keys behave the same either way.

## Decisions (auto)
- Complexity → small (one module, one schema section, no data).
- Size gate → not scaled (research answer to the roadmap Unknown).
- Plan review: W1 and S1 fixed in step 1 and step 5; S2 accepted.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Scale and colour schemes per screenshot

#### Automated
- [ ] 1.1 The new and updated screenshot, config and shots CLI tests pass with a local Chromium
- [ ] 1.2 `tests/schema.test.ts` passes on the regenerated file
- [ ] 1.3 Gates green (typecheck, lint, test) and build

#### Manual
- [ ] 1.4 Owner opens a light/dark pair at scale 2 and finds both sharp and in the right scheme
