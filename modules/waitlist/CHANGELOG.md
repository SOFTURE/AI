# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/waitlist`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`waitlist@x.y.z`).

## 0.1.7

- **Moving an existing list**: `importSignups(ctx, rows)` (`/server`) and the `import-signups` ops script
  (`/scripts`, `createImportSignupsScript(config, { scopeAliases })`) import the list an app kept before: the original
  sign-up time and id, placement, locale and channel, a consent per scope at its historical time and document version
  (privacy's `importConsent`), and, for who unsubscribed, the withdrawals at that time and an opt-out their next
  sign-up lifts. Checked whole before writing, one transaction, idempotent, never narrows scopes. New dependency:
  `@softure-ai/ops` (an optional module in `dependsOn`); `@softure-ai/privacy` `^0.1.7`.
- `getSignupById(ctx, id)`, for mailing's `legacyUnsubscribe.verify` when old links carry the row id.
- **Channel per sign-up**: migration `0003_add_channel.sql` adds `waitlist.signups.channel`; option `resolveChannel`
  fills it from the request (e.g. analytics' `getChannel`), `joinWaitlist` takes `channel`, `WaitlistSignup.channel`,
  `listSignups({ channel })`, `countSignupsByChannel(ctx)` and the privacy export carry it.
- **Unsubscribe link after sign-up**: option `unsubscribeLinkOnSuccess` (off by default) returns the person's own
  unsubscribe link as `unsubscribeUrl` with `status: "ok"`; `WaitlistForm` shows it (slot `unsubscribe`, copy
  `form.unsubscribeHint` and `form.unsubscribeLink`). The first sign-up refuses the option without
  `MAILING_UNSUBSCRIBE_SECRET`.

## 0.1.6

- `module.json` names `auth` as a required dependency (the privacy contributor reads `auth.users`).
- Adapters use the configured database handle; `@softure-ai/ui` is a peer dependency.
