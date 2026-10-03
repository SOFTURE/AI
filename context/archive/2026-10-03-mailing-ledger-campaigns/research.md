# Research: mailing-ledger-campaigns

Inputs: change.md, the EN-2 code in `modules/mailing/`, `foundation/db` (client, `softure` bin),
RFC 7208 (SPF), RFC 6376 (DKIM), RFC 7489 (DMARC), Resend's idempotency and rate-limit docs.

## Findings

1. **Exactly-once needs a claim before the send.** A provider idempotency key alone covers 24 hours
   (Resend) and only identical requests. A row per (scope, recipient key) claimed in one conditional
   statement (`INSERT … ON CONFLICT DO UPDATE … WHERE status = 'pending' OR stale claim`) gives one
   winner across processes without a transaction around the network call.
2. **Crash between send and record.** The claim stays `claimed`. After a stale-claim timeout the row
   can be claimed again and the mail is re-sent with the same idempotency key
   (`<scope>:<recipient key>`), so the provider folds it into the first send within its window.
   That is the strongest guarantee available without the provider's delivery webhooks.
3. **Outcome writes are fenced** by the attempt number the claim returned, so a worker whose claim
   went stale cannot overwrite the outcome of the worker that took over.
4. **Recipients are stored as keys.** The ledger uses `getRecipientKey` (sha256 of the normalised
   address), like `mailing.suppressions`: no address in the table, nothing new for the privacy
   registry (manifest `privacy` stays false).
5. **Lifecycle kinds need no registry.** A module picks a scope (`<module>.<event>:<entity>`) and a
   `kind`; the ledger stores both. Campaigns use `campaign:<id>` and must be list mail (a database
   check refuses `transactional`).
6. **Content file:** frontmatter (`id`, `kind`, `subject`, optional `html` path) and a plain-text
   body. No markdown renderer: it would add a dependency and a second rendering of the text. An
   HTML body is a separate file the operator renders however they like.
7. **Batch size and pace:** sends run one at a time (the provider limit is per second, not per
   batch). The CLI pauses 500 ms between sends by default (Resend's default limit is 2 requests per
   second); `--pause-ms` changes it.
8. **Retry policy:** `mailing.unavailable` releases the claim to `pending` for the next run; after
   5 attempts it becomes `rejected` with that reason. `rejected`, `invalid_input` and `suppressed`
   are final at once. Claims older than 15 minutes count as stale.
9. **DNS:** SPF is a single `v=spf1` TXT at the host (more than one is a permerror; `+all` is
   permissive); DKIM is `<selector>._domainkey.<domain>` with a non-empty `p=` (Resend's selector is
   `resend`); DMARC is `_dmarc.<domain>`, falling back to the parent domains (organisational
   domain), and `p=none` only monitors. Resend puts SPF on `send.<domain>`, hence `--spf-host`.
10. **CLI shape:** the `softure` bin in `foundation/db` loads `softure.config.*` with a dynamic import
    and exposes `runMigrateCli` for bundled scripts. `softure-mail` follows the same split
    (`runMailCli` + a thin bin).
