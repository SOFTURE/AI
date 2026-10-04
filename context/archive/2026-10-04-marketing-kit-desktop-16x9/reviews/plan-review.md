# Plan review: marketing-kit-desktop-16x9

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 14/14 paths, 9/9 symbols (`LAYOUTS`, `getGeometry`, `resolveLayout`, `fitsFrame`, `fitScale`, `cameraPose`,
`resolveVideos`, `Device`, `getFixtureVideo`), 2/2 commands (`npm run schema -w @softure-ai/marketing-kit`, gates from
`workflow.json`); ffmpeg, ffprobe and the Chromium builds for the opt-in render are present (`which ffmpeg ffprobe`,
`ls /opt/pw-browsers`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (recorder, composition, contract, fixture render: the roadmap outcome and Baseline "after") |
| Slicing | PASS (geometry and composition first, contract second, recorder last; each phase green on its own) |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (none) |
| Tests | PASS (snapshots guard the phone output byte for byte; the render guards the desktop end to end) |
| Security | PASS (local config; the address pill text is escaped) |
| Lean | PASS (no cursor, no hover/wheel actions, no per-video layout) |
| Fit | PASS (discriminated union for the device; one merge for layouts; pure geometry) |
| Cost and defaults | PASS (`kind` defaults to `phone`; `mobile` stays `true` for a phone) |
| Scope | PASS (`src/og/` untouched; FU-23 owns it) |
| Reuse | PASS (same scene module and voiceover in the fixture) |
| Lessons | PASS (none apply) |
| Progress format | PASS |

Deep checks (done by the reviewer):
- "Phone logs stay frame for frame": the recorder's only geometric input is `fitScale(geometry, rect)`
  (`record.ts:307`); keeping `getGeometry(viewport)` for phones leaves `frame.width` and `screenScale` unchanged.
- "The fixture voiceover serves the desktop film": `prepareFixture` writes the cache under
  `voiceoverKey(voiceoverText(beats), voiceId, modelId, language)` of `videos[0]` (`examples/fixture/prepare.ts`);
  a video with the same sentences and voice resolves to the same key.
- "`all` works for a video without post copy": `writePosts` returns null and `describePosts` prints a note
  (`cli/main.ts:82-96`); only `posts` fails without an entry.

## Findings

### W1 [WARNING] The fixture's opening shots would crop the text on a desktop page
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 3, step 2
**Problem:** the fixture app's paragraphs span the whole column (`main { padding: 32px 20px }`, no max width), so at
1280 px `#exit-age` is about 1240 px wide. The phone film's opening shot scale 1.6 puts its centre on the camera
target: 1240 × 1.05 × 1.6 ≈ 2080 px wide, so the left-aligned text starts off the 1920 px frame. Copying the phone
hook unchanged would render a film whose opening hides the number it talks about, and the render test would not see it.
**Fix:** the desktop fixture video sets its own hook scales (1.2 and 1.05), and Phase 3's manual check looks at the
opening frame as well as a scene frame.

### S1 [SUGGESTION] Say in the README that desktop hook and focus scales are usually lower
**Effort:** low. **Lens:** Fit. **Where:** Phase 2, step 5
**Problem:** a project copying a phone film's scales to a desktop film meets W1's crop.
**Fix:** one sentence in the formats paragraph: scales are relative to the screen, so a wide element on a desktop page
needs a smaller scale than on a phone.

## Applied
- W1: Phase 3 step 2 and item 3.3 updated.
- S1: Phase 2 step 5 updated.
