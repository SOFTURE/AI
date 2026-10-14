# Plan: mailing-delivery-jobs

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: medium (three phases).

## Goal

`@softure-ai/mailing/jobs` exports `enqueueDelivery`, `defineDeliveryJobHandler` and `getDeliveryJobResult`; the
provider's `Retry-After` reaches the job's retry delay; README and CHANGELOG carry the migration. All gates green.

**Out of scope:** moving auth or waitlist mails onto jobs (#494); campaigns and `runDeliveries` stay synchronous
(an operator command); a release.

## Approach

A handler factory over `deliverOnce` (research option 2). The job payload is `{ scope, payload }`: the ledger scope,
fixed at enqueue time and used as the dedup key, and the app's ids. The handler builds the mail when it runs
(`buildMail`), so no address or body is stored in `jobs.jobs`; `null` means nothing to send any more (the job
succeeds). The handler calls `deliverOnce` with `maxAttempts: null`: the job counts attempts, the ledger only guards
at-most-once. Outcome mapping:

| `deliverOnce` | job |
| --- | --- |
| `sent`, `done` | `ok()` |
| `rejected` (invalid, suppressed, rejected) | `failJob(reason)` |
| `retry-later` | `retryJobLater("mailing.unavailable", retryAfterSeconds)`, else an `Err` (queue backoff) |
| `halted` `quota_exceeded` / `provider_refused` | `retryJobLater(reason, retryAfterSeconds)`, else an `Err` |
| `in-flight` | `retryJobLater("mailing.delivery_in_flight", staleClaimMs / 1000)` |
| `uncertain` | `failJob("mailing.delivery_uncertain")`: the operator decides |

Rejected: option 1 (whole mail in the payload; personal data in the jobs table). The ledger's own attempt counting
stays for callers without jobs (issue ask 3): `deliverOnce` is unchanged for them.

## Phase 1: Retry-After from the provider to the outcome

**Discipline:** TDD. **Files:** `modules/mailing/src/{contract.ts,providers/resend.ts,server/send-mail.ts,
server/deliveries.ts}`, `tests/{resend,send-mail,deliveries}.test.ts`.

- `ProviderOutcome` failures, `SendMailFailure`, `DeliveryOutcome` `retry-later` and `halted` get an optional
  `retryAfterSeconds` (a whole number of seconds, 0 or more).
- `resend()` reads `Retry-After` (delta seconds or an HTTP date) on any failure status; `sendMail` passes a valid
  value through and drops an invalid one.

Done when: tests cover delta seconds, an HTTP date, a missing and a malformed header, and the field on `deliverOnce`.

## Phase 2: The jobs entry

**Discipline:** TDD. **Files:** `modules/mailing/src/jobs/index.ts`, `src/contract.ts` (two codes),
`src/messages/en.ts`, `package.json` (`./jobs`, optional peer `@softure-ai/jobs` `^0.0.0 || ^0.1.0`),
`module.json` and the inline manifest (`dependsOn.jobs: "*?"`), `tests/jobs.test.ts`.

- `enqueueDelivery(ctx, { queue, scope, payload, runAt?, delaySeconds?, maxAttempts? })`: refuses a malformed scope,
  enqueues `{ scope, payload }` with `dedupKey: scope`; returns `EnqueuedJob`.
- `defineDeliveryJobHandler({ payload, buildMail, deliverOptions? })`: a `JobHandler` whose schema checks the scope.
- `getDeliveryJobResult(outcome, { staleClaimMs })`: the mapping above, for an app with its own handler.

Done when: tests run real jobs (`runDueJobs` on a PGlite database with jobs and mailing) for sent, rejected,
suppressed, unavailable with and without `Retry-After`, quota, in-flight, uncertain, `buildMail` returning `null`, a
rolled-back enqueue, a duplicate enqueue, and a retried job that does not send twice.

## Phase 3: Docs

**Discipline:** docs. **Files:** `modules/mailing/README.md`, `modules/mailing/CHANGELOG.md`.

- README: a "Deliveries through jobs" part with queue config, handler, enqueue and the outcome table; the ledger
  section points to it instead of "call again later".
- CHANGELOG `## Unreleased`: the new entry, `retryAfterSeconds`, and a migration for an app that retries by hand.

Done when: the repository link test and the language gate pass.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Retry-After from the provider to the outcome

#### Automated
- [x] 1.1 Resend, sendMail and deliverOnce tests for `retryAfterSeconds` pass — 14a9004
- [x] 1.2 Gates green (typecheck, lint, test) — 14a9004

### Phase 2: The jobs entry

#### Automated
- [x] 2.1 Job handler tests over a real queue pass — 9d9d5c6
- [x] 2.2 Gates green (typecheck, lint, test, build) — 9d9d5c6

### Phase 3: Docs

#### Automated
- [ ] 3.1 README and CHANGELOG updated; link and language gates pass
