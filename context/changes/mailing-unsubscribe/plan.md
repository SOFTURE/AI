# Plan: mailing-unsubscribe

Input: change.md, research.md. Complexity: medium (2 phases).

## Goal

`@softure-ai/mailing` gains:

- migration `0001_create_suppressions.sql` (`mailing.suppressions`), manifest `dbSchema: "mailing"`,
  health check, the Drizzle table;
- `OutgoingMail.kind` (default `transactional`) and `mailing.suppressed`;
- signed links (`MAILING_UNSUBSCRIBE_SECRET`, `_PREVIOUS` for rotation), footer and RFC 8058
  headers on every list mail, suppression check in `sendMail`;
- `/server`: `getRecipientKey`, `buildUnsubscribeLinks`, `verifyUnsubscribeLink`, `isSuppressed`,
  `suppressRecipient`, `unsubscribe`;
- `/next`: `UnsubscribePage`, `unsubscribeAction`, `postUnsubscribeRoute`, `getUnsubscribeRoute`,
  `sendMail` with the shared database handle;
- routes `unsubscribe: "/unsubscribe"`, `oneClick: "/api/mailing/unsubscribe"`, messages en + pl,
  README.

The example mounts the page and the route, its test-mail page can send the mail as list mail
(`newsletter`), and `e2e/mailing-unsubscribe.spec.ts` covers one-click, the page and the refusal.

**Out of scope:** per-list preferences, resubscribe, bounce and complaint webhooks, an admin view
of suppressions, the ledger and campaigns (EN-3).

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Link identity | sha256 of the address, HMAC over it | no address in URLs or the table | research |
| Rotation | current + previous secret | sent links survive a rotation | research 1 |
| Scope | global per address | safe reading of RFC 8058 and law | research 2 |
| Footer | text and HTML, from messages | every body carries the link | research 3 |
| Rate limit | none on one-click, signature first | shared provider IPs | research |

Rejected: signing the address itself into the URL (personal data in logs); a token table (a row per
sent mail, and EN-3 owns delivery records); per-kind suppression now (no caller needs it, and it
would put the kind into the signature).

## Phase 1: Table, links and sendMail

**Discipline:** TDD.

- `migrations/0001_create_suppressions.sql`, `src/schema.ts`, manifest and `module.json`
  (`dbSchema`, `tables`, `env`, `routes`, `mount`), `src/server/health.ts`.
- `src/server/unsubscribe-link.ts` (key, sign, verify, links, secrets), `src/server/suppressions.ts`,
  `src/server/list-mail.ts` (headers, footer), `sendMail` and `validateMail` (kind).
- Messages en + pl (footer, page, `suppressed`).
- Tests: key normalisation, sign/verify (previous key, wrong key, malformed, short secret), links,
  footer (text, HTML with and without `</body>`, escaping), headers, `sendMail` (transactional
  untouched, list mail headers and footer, suppressed refusal, missing secret, database failure,
  owned headers refused, missing db throws), table constraints, idempotent insert, health check.

## Phase 2: Next adapter, example and e2e

**Discipline:** test-after (wiring), unit tests for the route and the action outcomes.

- `src/next/`: context, `UnsubscribePage`, `unsubscribeAction`, routes, `sendMail` with `db`.
- Example: `app/unsubscribe/page.tsx`, `app/api/mailing/unsubscribe/route.ts`, list-mail checkbox on
  `/account/mail`, messages, Playwright env `MAILING_UNSUBSCRIBE_SECRET`, `.env.example`,
  `e2e/migrations.spec.ts` ledger line.
- `e2e/mailing-unsubscribe.spec.ts`.
- README sections.

## Risks and rollback

- Migration rollback: `DROP TABLE mailing.suppressions; DROP SCHEMA mailing;` and delete the ledger
  row (written in the migration header). Reverting the code makes list mail impossible again, not
  wrong.
- A typo in a header name breaks one-click silently in clients: tests assert exact header names and
  values, and the e2e posts to the header URL.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Table, links and sendMail

#### Automated
- [ ] 1.1 Unit tests for links, footer, headers, suppression and every new `sendMail` branch pass
- [ ] 1.2 `module.json` equals `toModuleJson(mailing)`; table constraints and health check tested
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: Next adapter, example and e2e

#### Automated
- [ ] 2.1 `npm run e2e` passes against a local PostgreSQL 16, including `mailing-unsubscribe.spec.ts`
- [ ] 2.2 Gates green (typecheck, lint, test, build)
