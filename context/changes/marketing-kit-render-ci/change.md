---
change_id: marketing-kit-render-ci
title: "The marketing-kit fixture film renders in CI"
status: implementing
roadmap_item: FU-13
branch: claude/project-thread-ekulai
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

Every push runs the marketing kit end to end: the fixture film is recorded, composed and rendered to a draft
MP4 in CI, so a change that breaks recording, composition or the hyperframes render fails a check instead of
surfacing at the next real film.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-13** (roadmap `followups`, main since 2026-10-03):

> ### FU-13: The marketing-kit fixture film renders in CI
> - **Change ID:** `marketing-kit-render-ci`
> - **Status:** proposed
> - **Outcome:** A CI job (or a step of an existing one) installs a Chromium, sets `PLAYWRIGHT_CHROMIUM_PATH` and `HYPERFRAMES_BROWSER_PATH`, and runs `MARKETING_KIT_RENDER=1` on `tools/marketing-kit/tests/render.test.ts`.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether the e2e job's Playwright Chromium also serves hyperframes (a headless shell worked locally); the job's run time (about 85 s locally).
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-1 `mk-core-port`: the render test is opt-in and ran locally only (CI's test job has no browser). After: it runs on every push.
> - **PRD refs:** FR-24.
> - **Source:** `tools/marketing-kit/tests/render.test.ts`; `context/archive/2026-10-03-mk-core-port/research.md` (Open questions)

The MK-1 research decided the render test stays opt-in and named a CI job as a followup gap
([`research.md`, Open questions](../../archive/2026-10-03-mk-core-port/research.md)). Since MK-4 the `test` job of
`.github/workflows/ci.yml` sets `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome`, so the screenshot tests already
drive a browser in CI; the render test is still skipped there. The backlog entry this change was opened from is
[`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: `.github/workflows/ci.yml` (the new job or step). Lane F: FU-17 works in `tools/marketing-kit/src/og/`
  and does not touch CI.
- No paid text-to-speech: the fixture's voiceover is a generated tone (`examples/fixture/prepare.ts`).
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish by the agent; the owner tags releases.

## Notes

- Placement: roadmap `followups`, item FU-13 (taken from `context/backlog/roadmap-followups/`).
- Research done (quick depth): the roadmap Unknown (which Chrome hyperframes gets on a runner) needs reading
  hyperframes' browser resolution.
- Framing skipped: the outcome is not bug-shaped, the roadmap item pins the scope (one CI job running one existing
  test), and nothing questions whether the problem is the right one.
