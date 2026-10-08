---
change_id: marketing-kit-signed-in-shots
title: "marketing-kit 0.1.10: shots of signed-in screens (sign-in step, phrase from data, frames must differ, crop at a fixed aspect) (issue #253)"
status: archived
roadmap_item: null
issue: 253
branch: claude/project-thread-2n7q5v
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close every point of [issue #253](https://github.com/SOFTURE/AI/issues/253), so `softure-marketing shots` can produce
the product frames an adopting app still makes with its own integration test (signed-in screens with seeded data):

1. **Signed-in screens.** `marketing.json` describes how to sign in (a login page, steps, the phrase that proves
   the session), and entries opt into that session; nothing has to write a storage state file first. An optional
   preparation command creates and seeds the account.
2. **Phrase from the data on screen.** An entry's `expect` can name a value the preparation printed (an amount, a
   name read from the seeded database), so a frame of an empty or wrong account fails its phrase gate.
3. **Frames must differ.** Two files of one run with the same bytes fail: the page did not change between shots.
4. **Element crop at a fixed aspect ratio**: a frame as wide as an element, from its top edge, at `W:H` (e.g. `4:3`),
   with a gate on the file's dimensions.

A reviewer checks the screenshot tests (sign-in, placeholders, preparation, steps, crop, duplicate gate), the config
tests, the README and the CHANGELOG.

## Context

Issue #253. Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue. `shots` today: entries with
`storageState`, `scrollTo`, `waitMs`, four gates (status, scroll, phrase, size), `shots --page` for one page anywhere.

## Constraints

- Scope: `tools/marketing-kit` only. No other open PR touches it.
- A 0.1.9 `marketing.json` keeps working; the one new refusal for an old config is the duplicate gate (two
  identical files), which is the issue's point 3.
- Credentials never live in `marketing.json` and are never printed: they come from the environment or from the
  preparation command's output.
- English-only code and docs.

## Process notes

- Research: skipped as a separate file. The issue names the four gaps; reading `src/screenshot/*`, `src/cli/main.ts`,
  `src/cli/options.ts`, `src/config/schema.ts`, `src/config/actions-schema.ts`, `src/record/actions.ts`, the
  screenshot tests and the adopting app's frame generator answered every unknown; the findings are in plan.md's
  "Today" section.
- Framing: skipped. Each point is an observed adoption gap with a clear expected behaviour; the open design choices
  (where sign-in lives, the placeholder syntax, how the crop is computed) are settled in the plan.
