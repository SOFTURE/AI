---
change_id: marketing-kit-adoption-gaps
title: "marketing-kit closes the gaps FIRE_TRACKER found adopting it (issue #118)"
status: archived
roadmap_item: CF-2
branch: claude/project-thread-tahk2l
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

An app that adopts `@softure-ai/marketing-kit` can drop its own screenshot script and run a film end to end before
paying for a voiceover: `shots` takes an ad-hoc page (any address, one file, the same gates), a frame at a scroll
position, an extra wait and a signed-in browser state; `all`/`record`/`render` can run on a placeholder voiceover
that renders; and the README says where hyperframes keeps its Chrome, how an app should consume the kit, and no
longer shows FIRE's pre-redesign look as if it were current.

## Context

Source: GitHub issue [#118](https://github.com/SOFTURE/AI/issues/118) (2026-10-06), written while FIRE_TRACKER
adopted marketing-kit 0.1.2 (FIRE change `marketing-kit-adoption`, roadmap item BS-18,
`docs/05-adoption-playbook.md` step 7). FIRE keeps `scripts/screenshot.mts` until gaps 1-3 are covered.

The issue's items, as of `master` e2d1974 (checked in the code, not in the issue):

1. **No ad-hoc `shots`.** Every screenshot is a `marketing.json` entry; `--url` is only a base address and the
   pre-check needs `fetch().ok` on the first entry's path (`src/cli/main.ts` `shots`, `src/cli/server.ts`).
   FIRE's script takes `--url=<any page> --out=<file> --expect=<phrase>` for competitor pages and production checks.
2. **No scroll-offset frame and no extra wait** (`screenshotSchema` in `src/config/schema.ts`). FIRE has
   `--przewin=<px>` (one viewport frame at a scroll position, to verify scroll-driven motion) and `--wait=<ms>`.
3. **No authenticated screens.** `browser.newContext` takes no storage state, cookies or headers
   (`src/screenshot/screenshot.ts` `takeShot`).
4. **README: wrong Chrome cache path.** It says `~/.cache/puppeteer`; hyperframes 0.8.85 downloads into
   `~/.cache/hyperframes/chrome` and only falls back to the puppeteer folder.
5. **README: FIRE's pre-redesign look** in "From FIRE_TRACKER's constants" (`#059669`, the arc logo,
   `--accessible` as the CTA). FIRE now takes the CTA from its lime `accent` token and has the bridge tile logo.
6. **Not on npm.** Done since: marketing-kit 0.1.7 is on npm (MK-8, MK-11). Left: the README should say that an
   app runs the kit through `npx` with a pinned version rather than a devDependency (>100 MB of hyperframes,
   playwright, sharp and resvg in every `npm ci` and Docker deps stage).
7. **A renderable dry-run voiceover** (suggestion). The fake provider writes the text as the "audio", so `render`
   (ffmpeg `atempo`) fails on it; FIRE generated a tone and evenly spaced words like `examples/fixture/prepare.ts`.

The owner (2026-10-07, project thread): every item of the issue is done in this change, none is deferred as a gap;
at the end the issue gets a point-by-point comment, is closed, and the change is archived.

## Constraints

- Owns: `tools/marketing-kit/src/screenshot/`, `src/cli/` (options, main, voice, server), `src/config/schema.ts`
  and `config.ts`, `src/voice/` (a new placeholder module), `schema/marketing.schema.json`, the package README,
  tests, `docs/03-marketing-kit.md`.
- Backward compatible: a 0.1.7 `marketing.json`, its screenshots and its voiceover cache keep working unchanged.
- A placeholder voiceover never lands in the voiceover cache (a cache hit would stop the paid recording forever),
  and a recording made on it never renders with the real voiceover.
- A storage state holds session cookies: never logged, never written by the kit, the README says to keep it out of git.
- No paid call in tests or CI.
- The package bumps to 0.1.8; the owner publishes (run-wide order). FIRE_TRACKER is read only from here.
- Closes #118 with a comment item by item.

## Notes

- Decision (auto): placement → **work now**, main roadmap `charts-followups`, ID **CF-2** (CF-1 is the last ID on
  `master`; renumber on a collision at merge).
- Decision (auto): one change for all seven items: one outcome (FIRE drops its screenshot script and can rehearse a
  film for free) in the same package; phases keep the PR reviewable.
- Research done ([`research.md`](research.md)).
- Framing skipped: the problem is measured in a real adoption (FIRE keeps its own script because of gaps 1-3) and
  the owner ordered every item done; what is left are design choices (flag names, where a storage state and a
  placeholder live), settled in research and the plan.
- Archived 2026-10-07: every item of issue #118 is done (see [`reviews/impl-review.md`](reviews/impl-review.md)); marketing-kit 0.1.8 waits for its release.
