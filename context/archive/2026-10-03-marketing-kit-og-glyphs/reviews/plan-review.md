# Plan review: marketing-kit-og-glyphs

Reviewed: plan.md @ 2026-10-03. Mode: standard. Verdict: ready after fixes.
Findings: 1 critical, 1 warning, 1 suggestion.
Grounding: 6/6 paths, 5/5 symbols, 4/4 commands

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | FAIL (C1) |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | PASS (none) |
| Tests | WARN (W1) |
| Security | PASS (bounds-checked binary parsing, no throw on input) |
| Lean | PASS |
| Fit | PASS |
| Cost and defaults | WARN (S1) |

## Findings

### C1 [CRITICAL] "Any loaded font" is not what Satori draws
**Effort:** medium. **Lens:** Coverage and end state. **Where:** Key decisions "Coverage rule" (plan.md) · `node_modules/satori/dist/index.js` (`FontLoader.get`, `getEngine`, `kf`)
**Problem:** Satori groups fonts by family name and, for one text run, takes a **single** font per
family through `get({ name, weight, style })`; on a tie (same weight and style) the comparator
returns -1 and the first loaded file stays. Its fallback runs across family keys, not across files.
A brand with `inter-latin-400.woff` and `inter-latin-ext-400.woff` in one family therefore draws no
U+0105 (a with ogonek), while the planned check (any loaded file maps it) would pass it: the gap stays open for the
most common subset setup.
**Fix A (Recommended):** check the built tree: each text child with its inherited family, weight and
style; candidates are the requested family's selected font, then every family's selected font at
that weight and style, selected by a literal port of Satori's comparator; paths found by matching
the text to the data's string leaves. Strength: parity with Satori by construction, the weight a
text asks for is known. Trade-off: a comparator port to keep in step with Satori upgrades (pinned
by tests). Confidence: high, read from the 0.35.0 bundle. Blind spot: a future Satori with
`unicodeRange` support.
**Fix B:** keep "any file" and also refuse a second file of the same family, weight and style in
`loadOgFonts`. Trade-off: breaks configs whose subset files serve the video renderer (CSS
`unicode-range`); blind to cross-weight fallback.
**Decision:** Fix now (applied, Fix A): Key decisions (rows "Coverage rule", "Font selection",
"Texts checked"), Phase 1 steps 1 and 3, tests.

### W1 [WARNING] No test pins the subset-of-the-same-weight case
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, Tests
**Problem:** without it, a regression to "any file" passes every planned test.
**Fix:** add "latin + latin-ext of the same weight → still refused" and "latin-ext as another family →
renders".
**Decision:** Fix now (applied).

### S1 [SUGGESTION] The error advice must match the rule
**Effort:** low. **Lens:** Cost and defaults. **Where:** Phase 1 step 3 message
**Problem:** "add a latin-ext subset" would send the user to the setup that still fails (C1).
**Fix:** say that OG images use one file per family, weight and style, and file the gap of using
the further subset files as a followup.
**Decision:** Fix now (applied): message text, README step, step 6 (followup).
