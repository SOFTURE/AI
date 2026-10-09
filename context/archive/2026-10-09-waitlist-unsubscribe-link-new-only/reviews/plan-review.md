# Plan review: waitlist-unsubscribe-link-new-only

Reviewed: `plan.md` against `change.md`, issue #306, `src/next/actions.ts`, `src/server/signups.ts` and
`tests/next-join.test.tsx`.

Verdict: **approve**.

## Findings

### F1 (Warning): the issue's condition `status === "joined"` still leaks — accepted as D1
`joinNow` returns `status: "joined"` for a known address too (`isNew: false`). Only `isNew` separates the request
that created the row. **Decision:** D1.

### F2 (Suggestion): double opt-in is unaffected — checked
`confirmation_sent` never carried a link; the existing test keeps covering it. No plan change.

### F3 (Suggestion): no other caller depends on the link for a known address — checked
No example app, e2e spec or other package uses `unsubscribeLinkOnSuccess` or `unsubscribeUrl`. No plan change.
