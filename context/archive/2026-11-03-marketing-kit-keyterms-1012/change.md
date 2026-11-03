---
change_id: marketing-kit-keyterms-1012
title: "marketing-kit: key terms (Scribe keyterm prompting) for a footage film's transcript (issue #1012)"
status: archived
roadmap_item: null
issue: 1012
branch: claude/project-thread-dljs9h
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #1012](https://github.com/SOFTURE/AI/issues/1012). Scribe misspells proper and brand names in a footage
film's transcript, and the kit cannot pass Scribe v2's `keyterms`. After this change:

1. `FootageFilm.keyTerms?: string[]` (and `footage[].keyTerms` in `marketing.json`), checked against Scribe's batch
   limits (1000 terms, 50 characters, 5 words each), trimmed, deduplicated and sorted;
2. `SttInput.keyTerms?: string[]`; the ElevenLabs STT provider sends one `keyterms` form field per term;
3. the transcript cache key carries the sorted key terms only when there are any (existing keys unchanged);
4. `FootageRates.keyTerms?` (a surcharge per second) priced into `estimateFootageFilm`, and `FootageCharge.keyTerms`
   (how many terms the call sent) so a ledger can price the surcharge; the README states ElevenLabs' surcharge with
   the date checked;
5. the fake STT provider records the key terms (it already records every `SttInput`; a test asserts it).

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/{film,providers,paid,pipeline,
elevenlabs,fake}.ts` and tests, `src/footage/keyterms.ts` (new), `src/config/{schema,config}.ts`,
`schema/marketing.schema.json`, `src/index.ts`, README, CHANGELOG. Issue #1014 (hyperframes temp-folder space) runs in
a parallel thread on marketing-kit: it touches the render step, `checkFootageTools`, the worker recipe and README
sections on the worker; overlap is limited to README and the CHANGELOG's `## Unreleased`.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- A film without key terms behaves and caches exactly as before.
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue names the gap and a concrete API; the code confirms it (see research.md).
