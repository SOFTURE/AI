---
change_id: mk-core-port
title: "FIRE's video pipeline runs from tools/marketing-kit with its tests"
status: plan_reviewed
roadmap_item: MK-1
branch: claude/project-thread-minoa1
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project can produce FIRE_TRACKER's vertical film (voiceover from the paid cache, a frame-by-frame
recording of the real app, the composition, the MP4 and the post copy) with
`softure-marketing <all|voice|record|render|preview|posts>` from `@softure-ai/marketing-kit`, without
any code from FIRE's `video/` folder. FIRE's `video/**` tests pass in the package (translated to
English), and a fixture film renders a draft MP4 locally. The configuration may still be FIRE-shaped,
but every path in it resolves relative to the config file, not to a repository.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MK-1).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MK-1** (quoted in full in
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:** `tools/marketing-kit` contains the FIRE_TRACKER pipeline, ported 1:1 with its tests:
>   `voiceover`, `timeline`, `record`, `compose`, `render` (ffmpeg + pinned hyperframes), `posts`;
>   a CLI `softure-marketing <all|voice|record|render|preview|posts>` with preflight (ffmpeg, hyperframes).
>   Config may still be FIRE-shaped. Paths resolve relative to a config file, not the repo.
> - **Unknowns:** which tests depend on the FIRE app itself (site-token parsing of `globals.css`,
>   channel tags) and how to stub them; whether GSAP and hyperframes can be npm dependencies with no
>   files copied into the package.
> - **Baseline:** FIRE `video/**` tests (film, timeline, voiceover, compose, posts, site tokens).
>   After: the same tests are green in the package, and a fixture film renders a draft MP4 in CI or locally.

Current state: `tools/marketing-kit/` holds only a README and empty folders (`src/*/.gitkeep`). The
source is FIRE_TRACKER `video/src/*.ts` (about 1.9k lines with tests) at `58e6c84`, read-only.

## Constraints

- Exclusively owns `tools/marketing-kit/` as a whole. MK-2…MK-8 wait for this item; nothing else in
  the repository is touched apart from the lockfile, the roadmap rows and the followups backlog.
- English-only code, comments, test names and messages (AGENTS.md); user-facing copy (post labels,
  the persona card) lives in `src/messages/{pl,en}.ts`.
- GSAP and hyperframes are npm dependencies (hyperframes pinned); no third-party file is copied into
  the package. No Pixabay SFX and no fonts are bundled.
- FIRE_TRACKER is read-only: code is copied from it, never changed there.
- No release, tag or publish (the owner tags releases).

## Notes

- Research: done (two unknowns, external binaries). Framing: skipped, the roadmap item fixes the
  outcome and the scope; there is no problem in doubt to frame.
- Owner rules for this thread (2026-10-03): full SOFTURE process; master is the source of truth and
  conflicts are resolved without asking; gaps go to the followups roadmap, not fixed here.
