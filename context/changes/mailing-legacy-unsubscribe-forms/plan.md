# Plan: mailing-legacy-unsubscribe-forms

Input: change.md (research and framing skipped, see its Notes). Complexity: small.

## Goal

An app configures `legacyUnsubscribe: { params: { required: ["t"], optional: ["u"] }, verify }`,
`oneClickInvalidLinkStatus: 200` and an `onUnsubscribed` hook that reads `event.link.values.u`; both its old link
forms unsubscribe, a forged link on the one-click route gets 200 and stores nothing, and the hook finds the row.

**Out of scope:** letting `verify` return no address (the suppression list is keyed by address), a different
status for the page, a release in this change's commits.

## Approach

**Starting point:** see change.md Context.

**Key decisions:**
| Decision | Choice | Why |
| --- | --- | --- |
| Optional params shape | `params: string[] \| { required: string[]; optional?: string[] }` | the issue's suggestion; the array stays the short form for "all required" |
| Limits | 1-8 required, 0-8 optional, at most 8 names in total, no repeats across both, never `r`/`status` | the existing limit and reserved names, applied to the union |
| An optional value that is empty | treated as absent | the same rule as for required values (empty = not there) |
| An optional value over 512 characters | the link is invalid (`null`) | same as a required one: never hand `verify` an oversized value |
| Invalid-link status | top-level `oneClickInvalidLinkStatus: 200 \| 400`, default 400 | it is a property of the route, not of legacy links: signed links leak the same oracle |
| Hook payload | `event.link: { scheme: "signed" } \| { scheme: "legacy"; values }` | a discriminated union (conventions); adding a field breaks no existing hook |
| Version | no bump in the change commits | the release is cut separately after both mailing issues merge |

## Phase 1: options, link reading, route and hook

**Discipline:** TDD. **Files:** `modules/mailing/src/contract.ts`, `src/options.ts`, `src/server/unsubscribe-link.ts`,
`src/server/suppressions.ts`, `src/next/route.ts`, `src/index.ts` (export the new type), `tests/module.test.ts`,
`tests/suppressions.test.ts`, `tests/next.test.ts`, `README.md`.

1. Tests first (red): option parsing (object form accepted; empty `required`, a repeat across lists, `r` in
   `optional`, more than 8 names in total refused); reading (`t` only → `{ t }`, `u&t` → `{ u, t }`, empty `u` →
   `{ t }`, `u` over 512 → `null`, `u` only → `null`); the hook gets `link` for signed and legacy links; the route
   answers 200 for a forged link with the option and 400 without, and still 500 on a throw.
2. `contract.ts`: `LegacyUnsubscribeParams`, `UnsubscribeEvent.link`; `options.ts`: the union schema with the
   limits above and `oneClickInvalidLinkStatus`.
3. `unsubscribe-link.ts`: normalise `params` to `{ required, optional }` and read both.
4. `suppressions.ts`: `verifyLink` returns the key and the link shape; the hook gets `link`.
5. `route.ts`: the configured status for `mailing.invalid_link`.
6. README §10 and the options table: the object form with the two-form example, the new option and why, `event.link`.

**Done when:**
- Automated: new tests red before and green after; gates green (typecheck, lint, test, build).
- Manual: the README example type-checks against the package (verified by agent in a scratch test).

## Risks and rollback

- An app sets `oneClickInvalidLinkStatus: 200` and a mail client never retries a link the app broke: the page
  still shows the error, and a broken link is the app's bug either way. Documented.
- Rollback: revert the phase commit; defaults never changed.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: options, link reading, route and hook

#### Automated
- [ ] 1.1 New tests fail before the implementation and pass after
- [ ] 1.2 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 1.3 README example type-checks against the package
