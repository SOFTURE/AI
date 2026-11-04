---
change_id: marketing-kit-keyterms-1012
verdict: approved
---

# Implementation review

Reviewed the diff of 9340f49..7e7c792 against plan.md and the issue's five proposals.

- Ask 1: `FootageFilm.keyTerms` and `footage[].keyTerms`; `normalizeKeyTerms` trims, collapses inner spaces, drops
  blanks and exact duplicates, sorts by code point, and names each term over 50 characters or 5 words and a list over
  1000. The config schema refines with the same function, so config and pipeline agree.
- Ask 2: `SttInput.keyTerms`; the ElevenLabs provider appends one `keyterms` field per term and none for an empty list
  (tested both ways).
- Ask 3: `getTranscriptCache` adds `keyTerms` to the key only when non-empty: a film without key terms (absent, `[]`
  or blanks) keeps its key; order, spacing and repeats do not change it (tested).
- Ask 4: `FootageRates.keyTerms` is added to the transcribe rate for a film with key terms; absent means no surcharge
  (tested with real ffmpeg, skipped where it is missing). `FootageCharge.keyTerms` counts the terms sent. The README
  states the surcharge ($0.05/h on $0.22/h, checked 2026-11-03). Metering's structural `FootageChargeLike` is
  unaffected; it prices from `credits` or seconds as before.
- Ask 5: the fake STT records every `SttInput`; a pipeline test asserts the normalized key terms it received.
- Failures are values: invalid key terms fail `transcribeFootage` and `estimateFootageFilm` before any probe or paid
  call. Placeholder runs ignore key terms (no STT call).
- Gates: marketing-kit footage suites and config/schema tests green; typecheck, ESLint and the language gate green in
  the pre-commit hook.

Verdict: approved.
