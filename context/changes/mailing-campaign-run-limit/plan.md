# Plan: mailing-campaign-run-limit

Input: change.md (research and framing skipped, see its Notes). Complexity: small.

## Goal

`sendCampaign(ctx, { campaign, recipients }, { limit: 80 })` on a list of 200 new recipients sends 80, returns
`remaining: 120`, and the next run with the same limit sends the next 80. `softure-mail campaign launch.md --limit 80`
does the same from the command line.

**Out of scope:** a daily schedule (the operator or a cron runs the command), reading the provider's quota, a
limit for `deliverOnce` (one mail).

## Approach

**Starting point:** see change.md Context.

**Key decisions:**
| Decision | Choice | Why |
| --- | --- | --- |
| Name | `limit` | the issue's first suggestion; the CLI flag reads naturally (`--limit 80`) |
| What counts against it | every mail handed to the provider: sent, `retry-later` and provider rejections (`reachedProvider`, the predicate `pauseMs` already uses) | it bounds provider calls in the run, which is what a shared quota needs; done, suppressed, filtered, invalid, in-flight and uncertain recipients never reach the provider |
| Where the cut happens | before a recipient, once `limit` mails reached the provider | a recipient after the cut is never claimed, so the ledger is exactly as a shorter list would leave it |
| `remaining` | after the cut the run reads the rest of the list and counts it as `planCampaign` counts `toSend` (same retake rule); `0` when the run reached the end of the list; `null` when it halted | the operator learns how many instalments are left; a halted run did not read the rest, so it cannot say |
| `recipients` in a limited run | every distinct recipient read, including those past the cut | the run reads the whole list to count `remaining` anyway |
| Shared counting | extract the ledger, filter and suppression count from `planCampaign` into one helper both use | one definition of "would be sent", as the issue asks |
| Invalid `limit` | a whole number of at least 1, otherwise `sendCampaign` throws a `RangeError` | a wrong limit is a caller's bug, not an expected failure |
| CLI | `--limit <n>` (campaign only, 1-1000000); the dry run adds `this run would send <min(toSend, n)>`; a run cut by the limit logs how many are left and exits 0 | a planned instalment is a success; open or uncertain recipients still exit 1 as today |
| Version | no bump in the change commits | the release is cut after the merge |

## Phase 1: limit, remaining and the CLI flag

**Discipline:** TDD. **Files:** `modules/mailing/src/server/campaigns.ts`, `src/cli/run.ts`,
`tests/campaigns.test.ts`, `tests/cli.test.ts`, `tests/import.test.ts` (summary shape), `README.md`, `CHANGELOG.md`.

1. Tests first (red): a limit of 2 over 5 new recipients sends 2 with `remaining: 3`, and the next two runs send
   2 and 1 (`remaining` 1, then 0); done, unsubscribed and filtered recipients do not count against it; a provider
   rejection does; a halt inside the limit gives `remaining: null`; `limit` 0, 1.5 and NaN throw; without a limit
   `remaining` is 0. CLI: `--limit 2` sends 2 and prints what is left with exit 0; `--limit 0` and `--limit x` are
   usage errors; `--dry-run --limit 2` prints the per-run line.
2. `campaigns.ts`: `limit` in `SendCampaignOptions`, `remaining` in `CampaignSummary`, the shared counting helper,
   the cut.
3. `run.ts`: parse `--limit`, pass it on, print `remaining` and the dry-run line; usage text.
4. README (campaign section and CLI usage) and an `Unreleased` CHANGELOG entry.

**Done when:**
- Automated: new tests red before and green after; gates green (typecheck, lint, test, build).
- Manual: none.

## Risks and rollback

- A provider that is down makes `retry-later` outcomes eat the limit: the run sends fewer than `limit`, and the next
  run sends them. Documented as "mails handed to the provider".
- Rollback: revert the phase commit; without `limit` nothing changed except the new `remaining` field.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: limit, remaining and the CLI flag

#### Automated
- [ ] 1.1 New tests fail before the implementation and pass after
- [ ] 1.2 Gates green (typecheck, lint, test, build)
