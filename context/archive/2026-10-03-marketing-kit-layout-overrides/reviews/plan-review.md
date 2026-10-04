# Plan review: marketing-kit-layout-overrides

Reviewed: plan.md @ 2026-10-03. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 2 suggestion.
Grounding: 12/12 paths, 7/7 symbols (`LAYOUTS`, `getGeometry`, `fitScale`, `fitsFrame`, `resolveVideos`, `FilmScript`,
`getFixtureVideo`), 2/2 commands (`npm run schema -w @softure-ai/marketing-kit`, gates from `workflow.json`); ffmpeg,
ffprobe and the Chromium builds for the opt-in render are present in this environment (`which ffmpeg ffprobe`,
`ls /opt/pw-browsers`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS (geometry first, contract second; each phase green on its own) |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (none) |
| Tests | PASS after W1 |
| Security | PASS (config file read locally; no entry point) |
| Lean | PASS |
| Fit | PASS |
| Cost and defaults | PASS (no default changes; snapshots byte for byte) |
| Scope | PASS (frame, phoneBox, cameraTarget, per-video, FU-15/18/19 excluded) |
| Reuse | PASS (one merge used by geometry and schema) |
| Lessons | PASS (none apply) |
| Progress format | PASS |

Deep checks (done by the reviewer):
- "The recorder is unaffected": `record.ts:86` calls `getGeometry(viewport)`, and its only use is `fitScale(geometry, rect)`
  (`record.ts:307`), which reads `frame.width` and `screenScale` (`timeline.ts:168-171`); neither is overridable.
- "Every overridable value reaches the film through `Geometry`": `compose.ts:183` destructures `caption`, `persona`,
  `endCard`; CSS at `compose.ts:326-337`, end-card pose at `compose.ts:222-229`. No other reader of `LAYOUTS` in `src/`
  except `fitsFrame` (9:16 `phoneBox`, not overridable).
- `getFixtureVideo()` loads the fixture through `loadMarketingConfig` without ffmpeg (`examples/fixture/prepare.ts:27-33`),
  so `tests/layout.test.ts` runs in the default suite.

## Findings

### W1 [WARNING] "Differs only in the caption font size" needs a stated check
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 2, step 6 and Done when, second bullet
**Problem:** a snapshot alone proves the override output is stable, not that the override touched nothing else; a
merge that dropped another value would also produce a new, stable snapshot.
**Fix:** in `tests/layout.test.ts`, replace the overridden `font-size:56px` in the override HTML with the default
`font-size:50px` and expect the result to equal the default composition exactly.
**Decision:** Fix now (applied in the test design below; step 6 wording already says "differs ... only in that rule").

### S1 [SUGGESTION] `cli/main.ts:129` calls `getGeometry` without the override
**Effort:** low. **Lens:** Fit. **Where:** Phase 2, step 3
**Problem:** a reader may expect every caller to pass `film.layout`.
**Fix:** none needed: the summary line reads only `frame`, which no override changes.
**Decision:** Accept - leave the call as it is; the plan names the recorder and the CLI summary as override-free.

### S2 [SUGGESTION] `FilmScript.layout` is a new required field of an exported type
**Effort:** low. **Lens:** Fit. **Where:** Phase 2, step 3
**Problem:** library users that build a `FilmScript` by hand would need to add `layout`.
**Fix:** make it optional, or keep it required.
**Decision:** Accept as planned (required): the package is unpublished (`0.0.0`), every film comes from
`loadMarketingConfig`, and a required field keeps the render from silently ignoring the override.

## Triage summary
Fixed: W1. Accepted: S1, S2. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- W1 Exactness of the fixture comparison → Fix now (cheap, makes the test meaningful).
- S1 CLI summary call → Accept (reads only `frame`).
- S2 Required `layout` on `FilmScript` → Accept (unpublished package; every film comes from the config loader).
