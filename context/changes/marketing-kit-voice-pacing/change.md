---
change_id: marketing-kit-voice-pacing
title: "Paid voiceovers for a batch of films: paced calls, a stop on the first error, the real charge and a disclosure"
status: plan_reviewed
roadmap_item: MK-11
branch: claude/project-thread-ug90uc
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

An app that records the voiceovers of many films with `@softure-ai/marketing-kit` does it with one command that
cannot hammer the provider: paid calls are spaced by a configured interval (also across separate runs of the
CLI), the batch stops at the first provider error without sending anything more, every recording reports what the
provider really charged next to the estimate, and every post carries a configured disclosure line instead of a
copy pasted into each caption.

## Context

Source: FIRE_TRACKER SF-1 (`social-films-batch`, branch `social-films-batch`, `plan.md` Notes, 2026-10-06), the
first batch of films made with marketing-kit 0.1.6: 53 films, voiceovers recorded with a shell loop of
`softure-marketing voice <film> --commit`.

What happened there (quoted from FIRE's plan, translated from Polish):

> Phase 2, **paused at 26/53** (owner 2026-10-06): after 26 recordings in ~10 min (a shell loop) ElevenLabs sent an
> automatic Prohibited Use Policy §4 warning. The loop was killed; a disclosure was appended to the post
> descriptions (example persona, not investment advice, AI voice). Real cost: 7 292 credits for 17 504 characters
> (≈ 0.42 per character; balance 39 151 → 31 859), the package's estimate 1:1. The rest (27 films, 20 124
> characters) waits for MK-11 in SOFTURE/AI (`marketing-kit-voice-pacing`: pacing between calls, a stop on a
> provider error, the real cost, `social.disclosure`).

Four gaps, all in the package:

1. **No pacing.** `voice` records one film per run and nothing spaces the paid calls; a loop sends them back to
   back (26 in about 10 minutes).
2. **No stop.** One film per run means a provider error stops that run only; the next iteration of the loop calls
   again.
3. **Only the estimate.** `describeEstimate` prints the upper bound (1 credit per character); ElevenLabs charged
   0.42 per character and the CLI never says so, so the balance has to be checked by hand.
4. **No disclosure in the config.** FIRE pasted the same disclosure sentence (persona name inside) into 52
   captions by hand.

## Constraints

- Owns: `tools/marketing-kit/src/voice/`, `src/cli/` (options, voice, main), `src/config/` (schema, config),
  `src/posts/`, `schema/marketing.schema.json`, the package README and `examples/`.
- Backward compatible: a 0.1.6 config and cache keep working; the cache key does not change.
- No paid call in tests or CI: the fake provider and an injected `fetch` only.
- The package version bumps to 0.1.7; the owner publishes (run-wide order).
- FIRE_TRACKER is read only from this repo; its adoption is FIRE's own change.

## Notes

- Decision (auto): placement → **work now**, main roadmap `deploy-followups`, ID **MK-11** (FIRE already names it
  MK-11; MK-10 is the last MK on `master`). Not a DF item, the gap came from FIRE's adoption, as with MK-10.
- Decision (auto): one change for four gaps: one outcome (a batch of paid voiceovers and their posts without hand
  work or a provider warning) and the same files.
- Research done ([`research.md`](research.md)).
- Framing skipped: the problem and the wanted behaviour come from FIRE's measured run and the owner's pause; the
  remaining choices (interval default, how pacing survives a shell loop) are design choices settled in research
  and the plan.
