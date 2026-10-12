# Plan: mailing-stop-on-retry-later-394

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

`runDeliveries` and `sendCampaign` end at the first `retry-later` unless `stopOnRetryLater: false`, so an outage costs
one attempt per run instead of one per recipient.

## Key decisions

- **Where.** `deliverOnce` keeps answering `retry-later` (its contract is per delivery). The two runners check
  `outcome.status === "retry-later" && stopOnRetryLater` right after counting the outcome and calling `onDelivery`,
  and return like a halt. The stopping recipient stays counted in `retryLater`, as a halted one already is.
- **Summary.** `halted.reason` is `RunHaltReason` (`HaltingErrorCode | "mailing.unavailable"`), exported from
  `/server`; `CampaignHalt.reason` and `DeliveryRunSummary.halted.reason` use it. `httpStatus` is carried when the
  provider gave one (429, 503). `remaining: null`, `recipients` counts up to the stop, as at a halt.
- **Dry run and limit.** Unchanged: a dry run never reaches the provider; past the limit the run only forecasts.
- **CLI.** `HALT_EXPLANATIONS` gets `mailing.unavailable` ("the provider is unavailable or rate limited"); the type
  forces the entry.
- **Docs.** README (runDeliveries and campaign sections), CHANGELOG `## Unreleased`, doc comments.

## Phase 1: Stop at retry-later

Tests first in `tests/run-deliveries.test.ts` and `tests/campaigns.test.ts`: an outage on the second of three
recipients stops the run (one provider call for the outage, the third untouched, `halted` with the reason and
status, `remaining: null`, ledger `pending: 1, sent: 1`); a 429 the same; with `stopOnRetryLater: false` the run goes
on (the old tests keep this behaviour by passing the option). Then the code, the CLI entry, README and CHANGELOG.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Stop at retry-later

#### Automated
- [ ] 1.1 runDeliveries stops at the first retry-later by default and reports `halted` with `mailing.unavailable`
- [ ] 1.2 sendCampaign stops at the first retry-later by default and reports `halted` with `mailing.unavailable`
- [ ] 1.3 `stopOnRetryLater: false` keeps the run going in both
- [ ] 1.4 The CLI explains the new halt reason
- [ ] 1.5 Gates green (typecheck, lint, test)
