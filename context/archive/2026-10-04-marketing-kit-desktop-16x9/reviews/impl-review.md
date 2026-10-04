# Implementation review: marketing-kit-desktop-16x9

Reviewed: commits 669358a, 8336fa8 and the phase-3 work (aa12a41) against plan.md @ 2026-10-04. Mode: deep
(an independent reviewer read the whole diff; the agent rendered the fixture films and looked at frames).
Verdict: ready after fixes (all applied in aa12a41). Findings: 0 critical, 2 warnings, 4 suggestions.

## Plan conformance
| Phase | Result |
| --- | --- |
| 1: desktop layout and browser window | PASS (drift recorded in plan Decisions: `Device` union moved here) |
| 2: desktop device in marketing.json | PASS (two extra refusals tested) |
| 3: recorder desktop mode and fixture film | PASS (opt-in render: both films, 1920×1080 desktop MP4 with audio) |

Checks run: `npm run typecheck`, `npm run lint`, `npx vitest run tools/marketing-kit` (380 passed, 18 skipped),
`npm run build`, the opt-in render (`MARKETING_KIT_RENDER=1`, passed three times, the last on aa12a41). The four
phone snapshots are unchanged; the phone and JSON-twin recording logs are still equal frame for frame.

## Findings

### W1 [WARNING] The persona card could cover the browser bar — fixed
`timeline.ts` desktop entry, `timeline.test.ts`. The card is about 103-110 px tall (two text lines at line-height
1.2-1.3 plus padding and border), not 96; from top 14 it reached 117-123 px while the window's bar started at 116.
Fix: `screenBox.top` 180 (bar from 128), camera target y 570 and caption top 890 move with it; the test asserts 110 px
of room for every desktop viewport.

### W2 [WARNING] `fill` cropped a page-wide desktop field — fixed
`record.ts` `fill`. Found on the first render's frames: the fixed 1.55 zoom on a 1240 px wide input put its label and
value off the frame. Fix: on a desktop `fill` zooms `min(1.55, fitScale(...))` (about 1.18 for the fixture's input);
phones keep 1.55, so phone logs do not change. README `fill` row says so.

### S1 [SUGGESTION] `mobile: false` on a desktop was accepted — fixed
The schema now refuses any `mobile` on a desktop device (a phone's setting); test for `false` added.

### S2 [SUGGESTION] Stale "phone" wording — fixed
`timeline.ts` (end-card pose, `getGeometry`, `cameraPose`), README lead paragraph, `wide` and `tap` rows.

### S3 [SUGGESTION] Test gaps — fixed
Added: a video's phone device wins over a shared desktop `app.device`; a phone 16:9 film gets `layout["16:9"]`, not
`layout.desktop`. The phone `mobile` default is asserted by the existing "builds each video's … device" test. The
recorder's desktop branches are covered by the opt-in render (CI job `render`).

### S4 [SUGGESTION] The window's inset rim is hidden under the screen — kept
Cosmetic: the inset shadow shows only around the bar. The window reads as a browser in the rendered frames; no change.

## Security
The address pill text (`endCard.url`) is escaped (`escapeHtml`, test with `<plan>`). No new input reaches a shell or
a URL; config is a local file.

## Gaps for the followups roadmap
None found.
