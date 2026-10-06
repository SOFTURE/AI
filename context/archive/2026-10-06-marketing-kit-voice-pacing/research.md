# Research: marketing-kit-voice-pacing

Input: change.md (MK-11). Sources: the package on `master` (851aabb); FIRE_TRACKER branch `social-films-batch`
(cf18f24d, read only): `context/changes/social-films-batch/plan.md`, `marketing.json`; the ElevenLabs API reference
(response headers).

## Current state

### One film per run, no pacing
- `src/cli/options.ts` `readOptions`: every film command takes exactly one film ("one film at a time").
- `src/cli/voice.ts` `produceVoiceover` → `src/voice/produce.ts` `produceVoiceover`: cache hit, else estimate,
  else (with `isCommit`) one `provider.synthesize`. Nothing records when the last paid call happened.
- FIRE ran `op run … npm run marketing -- voice <film> --commit` in a shell loop (plan Phase 2). Pacing inside one
  process would not have helped that loop; pacing must see earlier runs.

### Where earlier runs leave a trace
- Every paid call writes `<cacheDir>/<video-id>/<key>.json` right after the response (`writeVoiceover`). The
  newest modification time of a `*.json` in the cache is therefore the time of the last paid call, with no extra
  state file to commit or ignore.
- After a fresh `git clone` every file has the clone's time, so the first paid call waits the interval once. That
  is a safe failure (a delay, logged), never a burst.

### The charge
- ElevenLabs returns the credits a generation cost in the `character-cost` response header (API reference,
  "Response headers": `character-cost`, `request-id`). `src/voice/elevenlabs.ts` reads only the body.
- FIRE's measurement: 7 292 credits for 17 504 characters, so the estimate (1 per character) is a correct upper
  bound and stays; the real charge is reported next to it.
- `TtsRecording` (`src/voice/provider.ts`) has `audio` and `words`; a provider without the header must still work.

### Posts
- `src/posts/posts.ts` `buildPosts`: caption, then the link (or the link-in-bio line), then hashtags.
- `VideoPost` (`src/config/config.ts`) is resolved per video; the persona name is on the video (`persona.name`).
- FIRE's 52 captions end with the same Polish paragraph; only the persona name differs. In English: "<Name> is
  an example persona and the numbers were computed by the app's calculator; this is not investment advice.
  The voiceover is AI-generated." The first film's post has none.

## Answers

| Unknown | Answer |
| --- | --- |
| How does pacing see a shell loop? | From the newest `*.json` modification time in the cache directory; no state file. |
| Default interval | 60 s: FIRE's 26 calls came about 23 s apart; 60 s spaces 27 films over about half an hour, still unattended. `0` turns it off. |
| What stops a batch? | Any failed `synthesize` (HTTP error, connection, malformed body): nothing after it is sent, exit 1, the summary names what was recorded and what was not attempted. |
| Batch syntax | `voice <film> [<film>…] [--commit]`; other commands keep one film. |
| The charge | `character-cost` header → `TtsRecording.charged` (number or null); logged per film and summed. |
| Disclosure | `social.disclosure` (template, `{persona}` = the video's persona name), its own paragraph after the caption; `posts[].disclosure: false` opts a post out. |

## Risks

- Pacing that sleeps in tests: the clock and the sleep are injected.
- A provider that reports nothing: `charged: null`, the log says the provider did not report it.
- A disclosure doubled in FIRE's captions after adoption: FIRE removes its pasted lines when it adopts 0.1.7;
  recorded in the README's upgrade note.
