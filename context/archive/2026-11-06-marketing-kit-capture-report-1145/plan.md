---
change_id: marketing-kit-capture-report-1145
status: archived
---

# Plan: report hyperframes' capture path (issue #1145)

Input: change.md, research.md. Complexity: small.

## Phase 1: the parser (`src/footage/hyperframes-capture.ts`)

- `HyperframesCapture { path: "beginframe" | "screenshot" | "drawelement" | null; gpu: "software" | "hardware" | null;
  seconds: Partial<Record<CaptureStage, number>>; isEncodeStreamed: boolean; fallbackHint: string | null }`.
- `readHyperframesCapture(lines: readonly string[]): HyperframesCapture | null`: ANSI stripped, the last summary
  line wins, durations in seconds (`1m 31.4s` → 91.4), unknown parts make a line not a summary; null without one.
- Exported from the package index.

## Phase 2: the render (`pipeline.ts`)

- `runHyperframesRender` keeps the non-progress lines it logs and returns `readHyperframesCapture(lines)`;
  `RenderedFootage` `rendered` carries `capture`.
- README "Footage films in a worker": the capture report and `lowMemory: true` pinning screenshot capture (issue's
  measurement). CHANGELOG `## Unreleased`.

## Acceptance

- Unit tests: the issue's summary line, a minute duration, streamed encode, ANSI colour, the hint, no summary → null,
  an unrelated `·` line ignored, the last summary wins.
- The fixture footage render test (`MARKETING_KIT_RENDER=1`) asserts `capture` is not null when it runs.
- Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- `path` and `gpu` are nullable because hyperframes prints each part only when known; `drawelement` is included as
  hyperframes' third mode.
- `encode (during capture)` is reported as `seconds.encode` plus `isEncodeStreamed: true`.

## Progress

- [x] Phase 1: `hyperframes-capture.ts` (`readHyperframesCapture`, types, `HYPERFRAMES_CAPTURE_STAGES`), exported from
  the index; `hyperframes-capture.test.ts` 7 pass.
- [x] Phase 2: `runHyperframesRender` returns the report, `RenderedFootage.capture`; README "Capture path", CHANGELOG
  `## Unreleased`. Marketing-kit unit tests 694 pass. `MARKETING_KIT_RENDER=1` worker film (hyperframes 0.9.6,
  chrome-headless-shell) renders and asserts `capture.path` and `capture.seconds.capture > 0`: pass (58 s).
