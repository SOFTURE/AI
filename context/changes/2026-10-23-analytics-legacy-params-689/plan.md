---
change_id: analytics-legacy-params-689
status: in_progress
---

# Plan: legacy names of the channel parameter (issue #689)

Input: change.md, research.md. Complexity: small (one package, readers and writers of one option, tests, docs).

## Phase 1: options, readers and writers (TDD)

Files: `modules/analytics/src/options.ts`, `src/channel-rule.ts`, `src/server/channel.ts`, `src/server/options.ts`,
`src/next/channel.ts`, `src/client/channel-keeper.ts`, `src/next/channel-keeper-client.tsx`, `src/proxy/index.ts`,
`src/server/endpoint.ts`, tests in `modules/analytics/tests/legacy-params.test.ts`.

1. Tests first, with `param: "ref", legacyParams: ["z"]`: options validation (pattern, distinct, not `param`, at
   most 4; `channelField` list rules); `readChannel` from the URL and the `Referer` with `?z=`, `?ref=` winning;
   `hasChannelParam` with the legacy name; `withChannel` and `tagPath` writing `ref` only; `getChannelFromSearchParams`
   (both input kinds); `getChannelRule` carrying the legacy names; the keeper remembering `?z=`, rewriting the
   address to `?ref=`, dropping `z` next to `ref`, leaving an invalid legacy value untouched; the tagger's rename
   redirect, `carry` and `tag` from a page tagged with the legacy name; the endpoint reading a cached page's `z`
   field and a `Referer` with `?z=`, two values counting no channel. Without `legacyParams` nothing changes (the
   existing suites).
2. Implement: `legacyParams` in the channel options; `readChannelParam(params, names)` in `channel-rule.ts`;
   `getChannelParams(options)`; readers use it; `withChannel` deletes the legacy names; the tagger renames;
   `ChannelRule.legacyParams`; `channelField` takes a name or a list.

## Phase 2: docs

`modules/analytics/README.md` (options table, a rename recipe), `CHANGELOG.md` `## Unreleased` with the migration.

## Decisions (auto)

- `channelField` accepts a name or a list (like `stepFields`) rather than a new `channelFields` key: an existing
  config keeps working and there is one option, not two.
- The first name present decides, valid or not, in the order `param`, then `legacyParams`; this keeps "a URL with
  the parameter decides".
- `hasChannelParam` counts a legacy name, so `tagPath` and `carry` leave a URL that already carries a channel alone.
- The tagger's rename redirect follows `targets` like any other `tag` redirect (the page itself as the source when
  there is no `Referer`). An invalid legacy value is not renamed, as an invalid `param` value is not touched.
- The keeper drops legacy names whenever it sees them next to `param`, since a `replaceState` costs no request; the
  tagger does not redirect for that case.

## Progress

- [ ] Phase 1: options, readers and writers
- [ ] Phase 2: docs
