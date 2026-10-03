# Plan: mailing-transport

Input: change.md, research.md. Complexity: medium (2 phases).

## Goal

`@softure-ai/mailing`:

- `mailing({ from, replyTo?, provider, timeoutMs? })`, options validated at startup;
- `MailProvider` contract, `resend({ apiKey?, endpoint?, fetch? })` adapter;
- `@softure-ai/mailing/server`: `sendMail({ config }, mail, { idempotencyKey? })` returning
  `Result<SentMail, MailingErrorCode>`, `validateMail`;
- `@softure-ai/mailing/next`: `sendMail(mail, options)` on the registered config;
- `@softure-ai/mailing/testing`: `fakeMailProvider({ outboxFile?, respond? })`, `readMailOutbox(file)`;
- messages en + pl (error copy), README (12 sections), `module.json`.

The example app enables the module with the fake provider (outbox file set by Playwright), adds a
signed-in page `/account/mail` that sends a test mail to the user's own address, and
`e2e/mailing-transport.spec.ts` captures it through the outbox.

**Out of scope:** unsubscribe, suppressions, mail kinds (EN-2), ledger and campaigns (EN-3), the
auth reset adapter (EN-4), attachments, cc/bcc, several recipients.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Templates | plain strings, `text` required, `html` optional | no renderer dependency | research 1 |
| Fake for e2e | memory + optional JSON-lines outbox file | e2e runs in another process | research 2 |
| Error mapping | rejected = retry useless; unavailable = retry later | callers decide retries | research 3 |
| Result | core `Result` with `mailing.*` codes | repository idiom, copy per code | research |
| Timeout | signal + race in `sendMail` | a provider cannot hang the caller | research |

Rejected: a React email renderer in the package (dependency weight, server-only rendering concerns);
a provider registry keyed by name (one provider per app is enough now); logging the provider's
refusal message (it can carry the address).

## Phase 1: Package, contract and providers

**Discipline:** TDD (every result branch is the contract).

- `package.json` (from `templates/package/`), `tsconfig*.json`, `module.json`, lockfile.
- `src/index.ts` (`defineModule`, no migrations), `src/options.ts`, `src/contract.ts`,
  `src/provider.ts`, `src/providers/resend.ts`, `src/server/send-mail.ts`, `src/server/validate.ts`,
  `src/testing/`, messages en + pl.
- Tests: options, validation (every reserved header, line breaks, addresses, key), each result
  branch of `sendMail`, timeout with a provider that ignores the signal, throwing provider, logs
  without mail content, Resend request shape and status mapping, fake (memory, outbox, idempotency,
  production refusal), module.json, messages.

## Phase 2: Next adapter, example app and e2e

**Discipline:** test-after (wiring).

- `src/next/`: `sendMail` on the registered config.
- Example: `softure.config.ts` (append `mailing(...)`), `app/account/mail/` page, form and action,
  link from `/account`, messages en + pl, `package.json` dependency, lockfile, Playwright env
  `MAIL_OUTBOX`.
- `e2e/mailing-transport.spec.ts`.
- README sections; docs index if it lists modules.

## Risks and rollback

- No migration; rollback is reverting the commits.
- A wrong mapping makes callers retry a permanent refusal or give up on a transient one: each
  status class has its own test.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, contract and providers

#### Automated
- [x] 1.1 Unit tests for every result branch, validation, timeout, logs, Resend mapping and the fake pass — 46a7f8b
- [x] 1.2 `module.json` equals `toModuleJson(mailing)` and the package passes `tests/repo/packages.test.ts` — 46a7f8b
- [x] 1.3 Gates green (typecheck, lint, test) — 46a7f8b

### Phase 2: Next adapter, example app and e2e

#### Automated
- [x] 2.1 `npm run e2e` passes against a local PostgreSQL 16, including `mailing-transport.spec.ts` — 09e34d7
- [x] 2.2 Gates green (typecheck, lint, test, build) — 09e34d7
