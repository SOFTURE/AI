---
change_id: mailing-delivery-jobs
---

# Research: mail deliveries through jobs (issue #492)

## Current state (master 3b765d4)

- `deliverOnce(ctx, { scope, mail, campaignId? }, options)` (`modules/mailing/src/server/deliveries.ts`) claims a
  ledger row (`mailing.deliveries`, unique per scope and recipient key), sends with the idempotency key
  `<scope>:<recipientKey>` and closes the row. Outcomes: `sent`, `rejected`, `done`, `in-flight`, `uncertain`,
  `retry-later` (claim released, attempt kept), `halted` (account refused or quota spent; attempt given back).
  `maxAttempts` (default 5, `null` = never) closes a repeatedly unavailable delivery as rejected.
- Nothing retries a `retry-later`: the README says "call again later"; `runDeliveries` and campaigns re-run by hand.
- The provider contract has no `Retry-After`: `ProviderOutcome` failures carry `httpStatus` only; `resend()` maps
  429 `rate_limit_exceeded` to `unavailable` and other 429s to `quota_exceeded`, 5xx/408/409-concurrent to
  `unavailable`. `sendMail` narrows the provider's answer in `readOutcome` (`send-mail.ts`), so a new field must be
  passed through there.
- `@softure-ai/jobs` (workspace version 0.0.0, unreleased): `defineJobHandler({ payload, run })`, `failJob(code)`,
  `retryJobLater(code, seconds)`, an `Err` retries with the queue's backoff; `enqueueJob(ctx, { queue, payload,
  dedupKey?, runAt?, delaySeconds?, maxAttempts? })` on the caller's transaction; dedup keys up to 200 characters;
  handlers run at least once; the README asks for id-only payloads.
- Pattern for an optional peer subpath: billing's `./mailing` entry with `peerDependenciesMeta.optional` and
  `module.json → dependsOn "mailing": "^0.2.0?"`.
- Repository rules: every `@softure-ai/*` range must accept the workspace version (`release-rules.mjs`), and
  `packages.test.ts` requires every module peer in `dependsOn`. `dependsOn` ranges accept `x.y.z`, `^`, `~`, `*`,
  each with `?`.
- #494 needs payloads with ids only (never the address or a token), so a handler that carries the whole mail in the
  job payload would not serve it.

## Options

1. A fixed queue `mailing.deliver` whose payload is the whole `Delivery` (address, subject, body). Simple, but puts
   personal data into `jobs.jobs` for up to 30 days, against the jobs README and #494.
2. **A handler factory**: the payload is `{ scope, payload }` with the app's ids; the handler builds the mail from the
   app's data when it runs and hands it to `deliverOnce`. The ledger key (scope) is fixed at enqueue time and is the
   dedup key. Serves #494 directly.

Chosen: 2.
