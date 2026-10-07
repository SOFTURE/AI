# Plan review: marketing-kit-portrait-templates

Verdict: **approved** with three findings applied to the plan.

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| P1 | `OgTemplate.build` and `RegisteredTemplate` are exported types (`OgTemplateContext` is public); adding a required third parameter to `build` would break a project that wrote its own template object against 0.1.7. | should | `slide` is the third parameter and existing templates ignore it; a two-parameter function still satisfies the type, so nothing outside breaks. Recorded in step 1.1. |
| P2 | The glyph check maps a missing character back to a JSON path by its text; the carousel builds only one slide, so a bad character on slide 3 is found only when slide 3 renders. | should | The CLI renders every slide, so `og` still refuses the entry; the error names `ogImages[i].data.slides[2]…`. Step 1.6 tests the path. |
| P3 | The plan said "test-after for CLI file names" but no test runs the CLI `og` command today. | note | Added: a test calls `writeOgImages` with a temporary output dir and checks the file names and sizes (phase 2.6). |
| P4 | Size presets with a transform: the JSON Schema must be generated from the input side, or the editor would reject `"portrait"`. | check | Holds: `getMarketingJsonSchema` uses `io: "input"`. |
| P5 | Old output byte for byte. | check | The snapshot test compares PNG bytes; phase 1's done-when also checks the two files are untouched in `git diff`. |

Coverage of change.md intent: big-number template (phase 1), carousel with counter (phase 1 + CLI in phase 2), brand
only (no new config), refused copy (schema caps + overflow oracle). Constraints: old templates unchanged (snapshots),
no network (local fonts), 0.1.8.
