---
project: "SOFTURE AI"
roadmap: engagement
version: 1
status: waiting
prd_version: 1
created: 2026-10-02
updated: 2026-10-02
backlog: context/backlog/roadmap-engagement/
trigger: "roadmap-identity is done (auth released and adopted by FIRE) and the owner promotes it"
---

# Roadmap engagement: mail, waitlist, MCP access and privacy

> Entries: [`context/backlog/roadmap-engagement/`](../../backlog/roadmap-engagement/). Queued roadmap (WORKFLOW §5.1):
> nothing here runs until the owner promotes it to `roadmap.md` (`softure-roadmap --promote engagement`).
>
> Run-wide orders once promoted (read by orchestrators):
> - Push main branch: no. The owner pushes and tags.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Owner at the keyboard: EN-9 (tags and first staged publishes), EN-10 (adoption run in FIRE_TRACKER).

Wave 2 of the module catalog (`docs/01-module-assessment.md`): the modules that talk to users outside the
app (mail, waitlist), to agents (MCP access) and to regulators (privacy). Every module follows
`docs/02-module-standard.md`; adoption in FIRE_TRACKER follows `docs/05-adoption-playbook.md`.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **EN-1** | `mailing-transport` | `@softure-ai/mailing` sends plain + HTML mail through an adapter (Resend first) with idempotency and a typed result | — | autonomous | ready |
| **EN-2** | `mailing-unsubscribe` | HMAC-signed unsubscribe links, RFC 8058 headers, one-click endpoint, unsubscribe page and a suppression list | EN-1 | autonomous | ready |
| **EN-3** | `mailing-ledger-campaigns` | exactly-once delivery ledger, campaigns sent from a content file, SPF/DKIM/DMARC check | EN-2 | autonomous | ready |
| **EN-4** | `auth-reset-via-mailing` | the auth password-reset sender hook is wired to `@softure-ai/mailing`, with pl + en templates | EN-1 | autonomous | ready |
| **EN-5** | `waitlist` | `@softure-ai/waitlist`: sign-up with configurable consent scopes, welcome mail, unsubscribe, `WaitlistForm` | EN-1, EN-2, EN-8 | autonomous | ready |
| **EN-6** | `mcp-access` | `@softure-ai/mcp-access`: hashed, scoped, expiring tokens, Bearer endpoint around the app's MCP server factory, token UI | — | autonomous | ready |
| **EN-7** | `privacy-registry` | `@softure-ai/privacy`: modules and the app register export/delete contributors; self-service export and account deletion | — | autonomous | ready |
| **EN-8** | `privacy-consents-legal` | `privacy.consents` ledger (who, what, when, document version) and a `LegalDocument` shell with content from the app | EN-7 | autonomous | ready |
| **EN-9** | `engagement-release` | mailing, waitlist, mcp-access and privacy 0.1.0 published through the release pipeline; READMEs and docs updated | EN-3, EN-4, EN-5, EN-6, EN-8 | owner | ready |
| **EN-10** | `fire-adopt-engagement` | FIRE_TRACKER replaces its mail, unsubscribe, waitlist, MCP token and GDPR code with the released modules | EN-9 | owner | ready |

## Order

Each module has its own migrations folder and Postgres schema (docs/02 §4), but this roadmap still allows
**at most one migration-adding item per parallel group**, so migration review stays one at a time.

1. **Group A (start):** EN-1 (owns `modules/mailing/`, no migration), EN-6 (owns `modules/mcp-access/`,
   migration), EN-7 (owns `modules/privacy/` registry and deletion, no migration).
2. **Group B:** EN-2 (owns `modules/mailing/` unsubscribe, migration) and EN-4 (owns the mailing sender
   wiring in `modules/auth/` and its adoption docs, no migration). Both need EN-1.
3. **Group C:** EN-8 (owns `modules/privacy/` consents and legal shell, migration), after EN-7.
4. **Group D:** EN-3 (owns `modules/mailing/` ledger and campaigns, migration), after EN-2.
5. **Group E:** EN-5 (owns `modules/waitlist/`, migration), after EN-1, EN-2 and EN-8.
6. **EN-9** (owner) after EN-3…EN-8, then **EN-10** (owner, runs in FIRE_TRACKER).

Hot shared files: the example app (`examples/next-app/`) gets one scenario file per item
(`examples/next-app/e2e/<module>-*.spec.ts`), so items never edit the same spec. `softure.config.ts`
of the example app is edited only by the item that adds its module, in its own commit.

Risk first: EN-1 (the transport contract every mail-sending module depends on) and EN-7 (the
contributor contract every module with user data depends on) start the roadmap.

## Items

### EN-1: Mail transport with provider adapters
- **Change ID:** `mailing-transport`
- **Status:** ready
- **Outcome:** `@softure-ai/mailing` exposes `sendMail()` over a `MailProvider` adapter interface with `resend()` as the first adapter: plain-text + HTML bodies, sender and reply-to from config, `Idempotency-Key`, timeout, protection of reserved headers, and a result union `sent | invalid-input | rejected | unavailable`. A fake provider ships for tests and the example app.
- **Prerequisites:** roadmap-identity done (core, db, ui, security released).
- **Unknowns:** Whether HTML templates are plain strings or React email components; how the fake provider exposes sent mail to e2e tests; which provider errors map to `rejected` vs. `unavailable`.
- **Risk:** medium. Every mail-sending module builds on this contract.
- **Baseline:** FIRE sends plain text only through a hand-written fetch. After: unit tests per result branch and an e2e scenario that captures a mail through the fake provider.
- **PRD refs:** FR-16, NFR-5.

### EN-2: Signed one-click unsubscribe and suppressions
- **Change ID:** `mailing-unsubscribe`
- **Status:** ready
- **Outcome:** Every non-transactional mail carries an HMAC-signed unsubscribe link and RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post` headers; a one-click POST endpoint and an unsubscribe page (Next adapter) record the opt-out in `mailing.suppressions`; `sendMail()` refuses suppressed recipients for non-transactional kinds.
- **Prerequisites:** EN-1.
- **Unknowns:** Secret rotation for the HMAC key (accept old and new during rotation?); whether suppressions are per mail kind or global; footer rendering in HTML vs. plain text.
- **Risk:** medium. A broken link or header hurts deliverability and compliance.
- **Baseline:** FIRE: signed links and headers exist, suppression is a column on its waitlist table. After: suppression works for any mail kind, covered by unit tests and an e2e one-click scenario.
- **PRD refs:** FR-16, NFR-5.

### EN-3: Delivery ledger and campaigns
- **Change ID:** `mailing-ledger-campaigns`
- **Status:** ready
- **Outcome:** `mailing.deliveries` and `mailing.campaigns` give exactly-once delivery (claim → sent | rejected, one outcome per recipient); a `softure-mail campaign` command sends a campaign from a content file over a regular database connection, honouring suppressions; a DNS check reports SPF, DKIM and DMARC for the sender domain.
- **Prerequisites:** EN-2.
- **Unknowns:** Batch size and retry policy for claimed-but-unsent rows; content file format (frontmatter + markdown?); how lifecycle mails (trial ending, etc.) register their kinds.
- **Risk:** medium. Double sends are visible to users.
- **Baseline:** FIRE runs campaigns through deployment-specific scripts. After: a campaign to N recipients produces exactly N ledger outcomes, re-running sends nothing new (unit + integration on PGlite).
- **PRD refs:** FR-16, FR-17.

### EN-4: Password reset mails through the mailing module
- **Change ID:** `auth-reset-via-mailing`
- **Status:** ready
- **Outcome:** An app that enables both auth and mailing gets password-reset mails without writing a sender: a ready `mailingResetSender()` adapter for the auth reset hook, transactional kind (never suppressed), `pl` and `en` templates, and an e2e scenario from request to new password.
- **Prerequisites:** EN-1; ID-5 `auth-password-reset` of roadmap-identity (sender hook) released.
- **Unknowns:** Where the adapter lives (auth depends on mailing optionally, or mailing ships the auth adapter); link expiry copy per locale.
- **Risk:** low.
- **Baseline:** Identity ships reset with a pluggable sender only. After: the example app resets a password end to end through the fake mail provider.
- **PRD refs:** FR-12, FR-16.

### EN-5: Waitlist with consent scopes
- **Change ID:** `waitlist`
- **Status:** ready
- **Outcome:** `waitlist.signups` (unique on normalised email) with consent scopes and form placements from config instead of hard-coded CHECK values; widening the consent scope on a repeat sign-up; welcome mail sent after the response through mailing; unsubscribe through EN-2; consent recorded through EN-8; rate-limited public action; a standalone `<WaitlistForm/>` with slots and messages.
- **Prerequisites:** EN-1, EN-2, EN-8.
- **Unknowns:** Whether consent scopes need a DB enum or a validated text column; double opt-in as an option; how placement analytics hand over to the analytics module later.
- **Risk:** low.
- **Baseline:** FIRE: the form is embedded in a domain component, scopes are CHECK constraints. After: the example app signs up, widens the scope, receives the welcome mail and unsubscribes (e2e).
- **PRD refs:** FR-18, NFR-5.

### EN-6: MCP access tokens and Bearer endpoint
- **Change ID:** `mcp-access`
- **Status:** ready
- **Outcome:** `mcp.access_tokens` (sha256 only, name, read/write scope, expiry, last use, per-account limit); token issue/revoke actions and UI that show the plaintext once; `POST /api/mcp` (rate limit, Bearer verification, `mcp:read` / `mcp:write` scopes) wrapping an app-provided `createServer({ userId, canWrite })`; writes need both an `allowWrites` config flag and a write token; client configuration instructions generated from config (server name, URL).
- **Prerequisites:** roadmap-identity done (auth, security).
- **Unknowns:** The supported `@modelcontextprotocol/server` version range; whether OAuth for MCP is in scope (likely a later item); how the app passes its tool catalog to the UI.
- **Risk:** medium. Token handling is security-critical.
- **Baseline:** FIRE has the full flow with a domain server. After: the example app issues a token and calls a demo MCP tool through the endpoint (e2e), unit tests cover expiry, revocation, scope and limits.
- **PRD refs:** FR-19, NFR-5.

### EN-7: GDPR export and deletion registry
- **Change ID:** `privacy-registry`
- **Status:** ready
- **Outcome:** A contributor contract in `@softure-ai/privacy` that every module and the app use to register `export(userId)` and `delete(userId)`; a JSON export endpoint and a self-service account deletion flow (confirmation, transaction across contributors, session cleanup); the already released identity modules register their contributors.
- **Prerequisites:** roadmap-identity done (auth released).
- **Unknowns:** Ordering of delete contributors with foreign keys across schemas; whether some contributors may veto deletion (e.g. legal retention) and how that is shown; export size limits.
- **Risk:** high. Deleting data wrongly is irreversible.
- **Baseline:** FIRE lists tables by hand and deletes accounts only from a CLI. After: export contains every registered contributor's data, deletion leaves no rows for the user in any module schema (verified by a test that scans all schemas).
- **PRD refs:** FR-20, NFR-5.

### EN-8: Consent records and legal document shell
- **Change ID:** `privacy-consents-legal`
- **Status:** ready
- **Outcome:** `privacy.consents` records every consent with subject, purpose, document version and timestamp; an API to record and query consent used by auth registration and the waitlist; `LegalDocument`, `LegalSection` and `LegalFooter` components (table of contents, change history) that render app-provided content.
- **Prerequisites:** EN-7.
- **Unknowns:** Consent withdrawal semantics (new row vs. update); how document versions are declared by the app; whether auth's stored consent from identity migrates into this ledger.
- **Risk:** medium. Compliance evidence must be complete.
- **Baseline:** FIRE checks consent at registration but does not store it. After: registration and waitlist sign-up both produce consent rows (unit + e2e), legal pages render from app content.
- **PRD refs:** FR-21.

### EN-9: Engagement modules release
- **Change ID:** `engagement-release`
- **Status:** ready
- **Outcome:** `@softure-ai/mailing`, `@softure-ai/waitlist`, `@softure-ai/mcp-access` and `@softure-ai/privacy` 0.1.0 published through the FD-2 pipeline (owner approves each first, staged publish and adds its trusted publisher); module READMEs and status lines updated; a finish review across EN-1…EN-8.
- **Prerequisites:** EN-3, EN-4, EN-5, EN-6, EN-8.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### EN-10: FIRE_TRACKER adopts the engagement modules
- **Change ID:** `fire-adopt-engagement`
- **Status:** ready
- **Outcome:** Following `docs/05-adoption-playbook.md`, FIRE_TRACKER adopts mailing, waitlist, mcp-access and privacy: its own implementations and unit tests are deleted, existing tables move into the module schemas through `--adopt`, its integration suite stays green, and every gap found becomes an issue in SOFTURE/AI.
- **Prerequisites:** EN-9.
- **Unknowns:** Data migration of existing waitlist rows and delivery history into the module schemas; whether FIRE's domain MCP server fits the factory contract unchanged.
- **Risk:** high. Production data is moved.
- **Baseline:** FIRE runs its own copies. After: those copies are gone, FIRE CI is green, CHANGELOG entries say `verified in: FIRE_TRACKER@<sha>`.
- **PRD refs:** FR-26, G-2.

## Owner decisions and checks

- [ ] **EN-9**: approve the first (staged) publish of mailing, waitlist, mcp-access and privacy on npmjs.com, then add a trusted publisher for each.
- [ ] **EN-10**: schedule the FIRE_TRACKER adoption run; confirm a production database copy is available for the `--adopt --plan` dry run.

## Done

(nothing yet)

## Decisions (auto)

- The suggested ten items are kept; the unsubscribe page and suppressions stay in EN-2 rather than a separate item. → Suppressions only make sense together with the one-click endpoint.
- The at-most-one-migration rule is applied per parallel group even though migrations live in per-module folders. → It keeps review of schema changes serial; the owner can relax it when promoting.
- EN-4 is a wiring item, not a new feature. → The token-based reset itself belongs to roadmap-identity; this item only lets it send through the mailing module.
- No item depends on a roadmap-identity ID in the table. → The trigger already requires the whole identity roadmap to be done.
