# Research: the tagger throws on an unparsable Referer (issue #702)

## Current state (master 5b619cb)

- `modules/analytics/src/proxy/index.ts`, `tag()`: `source` is built as
  `isRename && (referer === null || !URL.canParse(referer)) ? url : new URL(referer ?? url)` before the
  `channel === null` check. Outside a rename, an unparsable Referer makes `readRequestChannel` return `null`, but
  `new URL(referer)` runs first and throws.
- `readRequestChannel` already guards its own `new URL(referer)` with `URL.canParse`; `readChannel` with an
  unparsable Referer returns `null` (no throw).
- Outside a rename the request URL carries no channel parameter, so a non-null channel came from the Referer (or the
  `channelFromReferer` hook on that page): the Referer parses whenever `channel !== null`.
- Tests of the tagger's scope live in `modules/analytics/tests/tagger-scope.test.ts` (`createRequest` from
  `support.ts` sets the Referer header verbatim).

## Findings

- Returning `null` on `channel === null` before building `source`, and building `source` with one `URL.canParse`
  guard for both branches, removes the throw without changing any result for a parsable Referer.
