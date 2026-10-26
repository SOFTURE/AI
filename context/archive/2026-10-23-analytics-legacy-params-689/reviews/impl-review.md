---
change_id: analytics-legacy-params-689
verdict: approved
---

# Implementation review

Reviewed the diff of af843b2 and b4f6791 against plan.md and the issue's acceptance criteria.

- Readers: `readChannel` (request URL, then a first-party `Referer`), `hasChannelParam`, `getChannelFromSearchParams`
  (both input kinds), the keeper and the funnel endpoint (through `readChannel`) take `param`, then each legacy name;
  the shared `readChannelParam` in `channel-rule.ts` keeps "the first name present decides, valid or not". The
  proxy's two direct `searchParams.has(param)` checks now go through `hasChannelParam`, so a page tagged `?z=` is not
  re-derived by `channelFromReferer`.
- Writers: `withChannel` deletes the legacy names and sets `param`, so `tagPath`, `tagRedirect`, `carry` and the
  rename redirect write `param` only. The tagger answers a navigation carrying only a valid legacy value with a 307
  to `param`, within `targets`; the keeper moves it with `replaceState` and drops a legacy name next to `param`.
- Funnel wire: `channelField` takes a name or a list (1 to 4, each once, none a step field); one value in all counts.
  `readStep` and `readSingle` merged into one helper.
- Validation: legacy names follow the `param` rule, differ from `param` and each other, at most 4.
- Compatibility: without `legacyParams` behaviour is unchanged (existing suites pass; only the exact-equality tests of
  the parsed defaults and `getChannelRule` gained `legacyParams: []`). The parsed type of `channelField` widens; noted
  in the CHANGELOG.
- Tests: 19 cases in `tests/legacy-params.test.ts`, one per reader and writer plus validation, the tagger's scope and
  the endpoint. 176 analytics tests pass; typecheck, ESLint (zero warnings) and the language gate pass.

Verdict: approved, no changes.
