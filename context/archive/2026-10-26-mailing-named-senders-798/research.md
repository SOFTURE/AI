# Research: named senders in mailing (issue #798)

## Current state (master ba21b05)

- `mailingOptionsSchema` (`modules/mailing/src/options.ts`): `from` is one mailbox (`isMailbox`), `replyTo` one
  address. Both are read in `composeMessage` (`src/server/send-mail.ts`), which builds the `ProviderMessage` for
  `sendMail`, `sendMailUnchecked` (the `softure-mail test` path) and `previewMail`.
- `OutgoingMail` (`src/contract.ts`) has a per-mail `replyTo`, no per-mail sender. `From` is a reserved header
  (`RESERVED_HEADERS` in `src/address.ts`), so `headers` cannot set it.
- `validateMail(mail, options, limits)` parses the mail with zod and reports field names only; it does not see the
  config. The sender's name must be checked against the config, so the lookup sits in `send-mail.ts` next to the
  attachment-provider check.
- `deliverOnce` (`src/server/deliveries.ts`) passes `delivery.mail` to `sendMail` unchanged; the jobs adapter
  (`src/jobs/delivery-job.ts`) calls `buildMail` and then `deliverOnce`. A `sender` on the built mail rides along
  without further code. The job payload never holds the mail.
- `softure-mail dns` (`runDns` in `src/cli/run.ts`) checks one domain: `--domain`, else the domain of `from`, with
  `replyTo` of the config when `--domain` is not given. `--spf-host` and `--return-path` name hosts of that domain.
- `formatMailPreview` (`src/server/operator-output.ts`) already prints `From: <message.from>`.

## Findings

- Most apps put every sender on one domain (`alerts@` and `hello@` of the same domain): the DNS check must not
  repeat a domain, and its output for one domain should stay as it is today.
- With senders on several domains, host options (`--spf-host`, `--return-path`) belong to one domain each. A host
  is `send.<domain>` or another name under the domain, so a host can be matched to its domain by suffix.
- The reply-to and inbound checks are about where replies go, not about a sender; they belong to the report of the
  default sender's domain only, or the output repeats them.
