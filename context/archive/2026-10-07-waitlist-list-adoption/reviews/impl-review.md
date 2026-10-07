# Implementation review: waitlist-list-adoption

Reviewed: the branch against [plan.md](../plan.md), issue #214 and the rules in AGENTS.md. Effort: high. Gates:
`npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm run build` and the full `npm test` green on
the final commit.

## Against the plan

| Plan item | Where | State |
| --- | --- | --- |
| privacy `importConsent` (past time, older version) | `modules/privacy/src/server/consents.ts`, `tests/consents.test.ts` | done |
| channel column, `resolveChannel`, `listSignups({ channel })`, `countSignupsByChannel`, export | `migrations/0003_add_channel.sql`, `src/server/signups.ts`, `src/next/actions.ts`, `src/server/privacy.ts` | done |
| `getSignupById` (plan review #1) | `src/server/signups.ts` | done |
| `importSignups` and the `import-signups` script | `src/server/import.ts`, `src/scripts/` | done |
| unconfirmed row takes the imported scopes (plan review #2) | `getMergedRow` in `import.ts` | done, tested |
| `unsubscribeLinkOnSuccess`, setup check, form, copy | `src/options.ts`, `src/server/setup.ts`, `src/next/actions.ts`, `src/ui/waitlist-form.tsx`, `src/messages/` | done |
| README, CHANGELOGs, versions 0.1.7, privacy `^0.1.7` | both modules | done |
| no change in `modules/mailing` | uses `buildUnsubscribeLinks`, `signRecipientKey`, `getRecipientKey`, `unsubscribe`, `isSuppressed`, `readUnsubscribeSecrets` as exported | held |

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The time check first reported defaulted times too (`signedUpAt, confirmedAt, consentedAt` for one bad `signedUpAt`), naming fields the row never gave. | Fixed before commit: only the times a row gives are checked for shape and "not after now"; the order checks cover the defaults. Test "refuses invalid rows by number" pins the message. |
| 2 | Warning | An import row with an `id` against a pending double opt-in row (stored under a fresh id) is refused as "under another id", even though the app never knew that id. | Kept: the rule protects old links that resolve by id, and the refusal says what to do (drop `id` for that row). README states the id rules. |
| 3 | Suggestion | `optOut` reads each scope's consent state one query at a time; a 50 000-row import with many unsubscribed rows makes several queries per row. | Kept: an import runs once per app, inside one transaction; the batch lookups that matter (id and email clashes) are batched by 1 000. |
| 4 | Suggestion | `resolveRequestChannel` runs before the rate limit of `joinWaitlist`. | Kept: it reads the request (analytics' `getChannel` parses headers), costs no database work, and runs after `identifyClient`. |
| 5 | Suggestion | The unsubscribe link in the answer is a credential sent to whoever submitted the address. | Accepted in the plan review (#5): off by default, README states the trade-off, never with `confirmation_sent`, never logged. |

Security: imported times, versions and channels are validated before any write and stored through parameterized
Drizzle queries; refusals name row numbers, never addresses (asserted); the opt-out link is signed in memory and never
logged; `MAILING_UNSUBSCRIBE_SECRET` is only read, never echoed.

Tests seen red first: the new `importConsent`, `importSignups`, script, channel and unsubscribe-link tests target
functions and options that did not exist before this change; the three existing expectations that changed
(`channel: null`, `unsubscribeLinkOnSuccess: false`, the export's `channel`) failed until the code carried them.

| 6 | Warning | The full `npm test` caught two gaps the waitlist-only runs did not: the repository test requires `ops` in `dependsOn` (billing names it as optional, `^0.1.0?`), and the module test still expected privacy `^0.1.0` in the missing-module message. | Fixed in a793502: `dependsOn` names `ops: "^0.1.0?"`, the test expects `^0.1.7`; full `npm test` re-run green. |

No open findings. Verdict: ready to merge.
