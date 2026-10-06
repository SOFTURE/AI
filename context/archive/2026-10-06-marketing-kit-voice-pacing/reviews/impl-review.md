# Implementation review: marketing-kit-voice-pacing

Verdict: **approved** after one fix (I1).

## Against the plan

| Phase | Planned | Done | Evidence |
| --- | --- | --- | --- |
| 1 | the real charge from `character-cost`, logged next to the estimate | yes | `elevenlabs.ts` `readCharge` (missing, empty, word and negative headers give null); `produce.ts` `describeCharge`; tests in `elevenlabs.test.ts`, `produce.test.ts` |
| 2 | pacing from the cache's newest recording; `voice` takes several films; stop at the first failure; batch totals, also in a dry run | yes | `pace.ts` (`findLastRecordingTime`, `waitForPace`, injected clock and sleep); `batch.ts` (`produceVoiceovers`, `describeVoiceoverBatch`); `options.ts` (`filmIds`, duplicates refused); `main.ts` loads every film before the first call; `tests/voice-cli.test.ts` runs the CLI without a key: a dry run of two films prints the total and writes nothing, `--commit` stops at the first film and names the second as not attempted, an unknown id fails before any estimate |
| 3 | `social.disclosure` with `{persona}`, `posts[].disclosure: false` | yes | `schema.ts`, `config.ts`, `posts.ts`; tests in `config.test.ts` (filled, opted out, blank refused) and `posts.test.ts` (order: caption, disclosure, link, hashtags) |

Docs: README (commands, `voice` with several videos, the config table, the charge line, the upgrade note to
0.1.7), the fixture config sets `minIntervalSeconds` and a disclosure, JSON Schema regenerated, version 0.1.7.

## Verification

- Gates: typecheck, lint (with the language gate), test, build; results in the PR.
- Sabotage: with the `waitForPace` call in `produceVoiceover` disabled, the pacing test fails ("waits for the pace
  right before a paid call"), so the test sees the wiring and not only the helper.
- No paid call: every test uses the fake provider or an injected `fetch`; the CLI test removes
  `ELEVENLABS_API_KEY` from the child's environment.

## Findings

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| I1 | `VideoPost` is exported; a required `disclosure` would break a project that builds `PostsInput` by hand against 0.1.6. | should | Fixed: `disclosure?: string \| null`; `buildPosts` treats absent as none. |
| I2 | Pacing counts from file modification times; after a fresh clone the first paid call waits the full interval once. | note | Accepted in the plan review (P4); the wait is logged. |
| I3 | ElevenLabs' policy warning may have been about content, not the rate; pacing alone may not prevent another one. | note | The disclosure (phase 3) and pacing are what FIRE asked for; whether the account needs more is the owner's call in FIRE (recorded for the owner below). |

## Manual checks for the owner

- In FIRE_TRACKER, after adopting 0.1.7: run `voice <remaining films>` without `--commit` first and compare the
  batch total with the balance; then with `--commit` (about one film a minute). Move the pasted disclosure lines into
  `social.disclosure`.
