---
change_id: analytics-two-origins
reviewed: implementation (phases 1-3)
date: 2026-10-07
verdict: approved with fixes applied
---

# Implementation review: analytics-two-origins

Checked the branch diff against `plan.md`, `change.md` and issue #210, point by point, and re-read it for
correctness, tests, security and project patterns.

## Coverage of the issue

| Issue point | Delivered | Evidence |
| --- | --- | --- |
| 1. Funnel endpoint behind a proxy | `analytics({ origins })`; `isFirstParty` checks `appOrigin` + `origins`; `readVisit` accepts their pages while `request.url` is internal | `tests/origins.test.ts` ("the funnel endpoint behind a proxy") |
| 2. `tag` moves visitors to `appOrigin` | `readPublicOrigin` maps `Host` (+ `X-Forwarded-Proto`) onto the configured list; `tag` redirects there, `appOrigin` otherwise | `tests/origins.test.ts` ("the tagger on two origins", "readPublicOrigin") |
| 3. Tag across first-party origins | server reads a cross-origin first-party `Referer`; `<ChannelKeeper />` tags links to the other origin on click (`tagLink`), since the default referrer policy drops the query | `tests/origins.test.ts`, `tests/client.test.ts` ("tagLink") |
| 4. Tagger `channelFromReferer` | `createChannelTagger(config, { channelFromReferer })` for `tag` and `carry` | `tests/origins.test.ts` ("createChannelTagger(config, { channelFromReferer })") |
| 5. `<FunnelPixel>` layout | `className` prop, `decoding="async"`, `position: absolute` without a class | `tests/next.test.ts` ("FunnelPixel") |
| 6. Known channels and the cap | `funnel.isKnownChannel(channel, ctx)` | `tests/funnel.test.ts` ("funnel.isKnownChannel") |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning (fixed) | `ChannelKeeperClient` dropped `rule.normalize` when it built the keeper (since 0.1.7), so the browser kept a raw tag the server normalises. | Fixed in phase 2 (the keeper now gets every rule field); listed in CHANGELOG. |
| 2 | Warning (fixed) | `carry` resolved a relative `Location` against `request.url` and wrote it back absolute, which behind a proxy names the internal host. | Fixed in phase 1: a relative `Location` stays relative; existing test updated, new one on the proxied request. |
| 3 | Suggestion | `isRelative` must not take `//host` or `/\host` for relative. | Covered: backslashes are read as slashes before the `//` check; `isFirstParty` still guards absolute targets. |
| 4 | Suggestion | `isKnownChannel` is asked even for a channel already counted (the SQL would not cap it anyway). | Kept: one hook call per tagged count is documented; checking the table first would add a query to every count instead. |
| 5 | Suggestion | Comments in the endpoint and counter named the app the code was extracted from. | Neutralised while touching the files (also README intro, client entry). |

Defaults unchanged: an app without `origins`, a tagger option, `isKnownChannel` or a pixel class behaves as on
0.1.7, except the two fixes above and the pixel's default `position: absolute` and `decoding`. New behaviour
was seen red before the implementation (phase 1 file failed on the unknown `origins` key; phase 2: 11 failures).
Gates: typecheck, lint, analytics + repository tests, build green; full `npm test` runs in `pre-push`.
