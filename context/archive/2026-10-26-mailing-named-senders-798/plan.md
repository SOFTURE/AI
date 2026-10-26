---
change_id: mailing-named-senders-798
status: archived
---

# Plan: a sender per mail (issue #798)

Input: change.md, research.md. Complexity: small (one package: options, contract, send path, CLI dns, docs).

## Phase 1: options, contract and the send path (TDD)

Files: `modules/mailing/src/options.ts`, `src/contract.ts`, `src/server/validate-mail.ts`,
`src/server/send-mail.ts`, `tests/senders.test.ts` (new).

1. Tests first: `sendMail` with `sender: "alerts"` hands the provider `from` = the configured `alerts` mailbox;
   without `sender` it is `from`; an unknown name, a non-string or a name on a config without `senders` is
   `mailing.invalid_input`, logged `fields=sender`, nothing sent; `previewMail` shows the resolved `From` and
   reports `fields: ["sender"]`; `deliverOnce` and a queued delivery send from the named sender; options refuse a
   sender that is not a mailbox and a name that is not `[A-Za-z][A-Za-z0-9_-]{0,31}`.
2. Options: `senders?: Record<name, mailbox>`, each value validated like `from`.
3. `OutgoingMail.sender?: string`; `validateMail` checks it is a sender name (`ValidMail.sender: string | null`).
4. `resolveSender(config, valid)` in `send-mail.ts`: the mailbox, or `null` for an unknown name; used by
   `sendMail`, `sendMailUnchecked` and `previewMail` before anything is sent; `composeMessage` takes the mailbox.

## Phase 2: `softure-mail dns` over every sender (TDD)

Files: `src/cli/run.ts`, `tests/cli.test.ts`.

1. Tests first: without `--domain`, a config whose senders share `from`'s domain prints one report as before; a
   sender on another domain adds a second `sender domain` report and a failure there fails the command; reply-to
   and inbound checks appear only in the first report; with several domains, `--spf-host send.<domain>` applies
   to its own domain and a host under none of them is a usage error; `--domain` checks that domain alone.
2. Implementation: list the distinct domains of `from` and `senders` (first `from`), assign host options by
   suffix when there is more than one domain, run `checkSenderDns` per domain and sum the failures.

## Phase 3: docs

`modules/mailing/README.md` (senders section, dns over all senders), `modules/mailing/CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Sender names follow the link-parameter shape (`[A-Za-z][A-Za-z0-9_-]{0,31}`): short, safe in a log, and wide
  enough for `alerts` or `clientMail`.
- `replyTo` stays one configured value plus the per-mail override; a sender does not carry its own reply-to (not
  asked, and `OutgoingMail.replyTo` covers it).
- Campaign files and `softure-mail test` keep the default sender; named senders are for app mail. A campaign
  `sender` field can follow when an app needs it.
- `dns`: with several domains, host options are matched to the domain they sit under; with one domain they apply
  as before, so no existing command line changes meaning.

## Progress

- [x] Phase 1: options, contract and the send path (9b8b077)
- [x] Phase 2: `softure-mail dns` over every sender (94cb11b)
- [x] Phase 3: docs (656446f)
- [x] Implementation review fixes (988b9eb)
