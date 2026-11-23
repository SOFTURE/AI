# Plan: mailing-keyed-recipient-key

## Approach

The same small derivation in mailing and privacy (the two packages do not depend on each other; waitlist's test pins
that they agree), reading `SOFTURE_EMAIL_KEY_SECRET` from the environment. Then the SQL surface, docs and every
caller and test that needs the secret.

## Decisions (auto)

- One secret for both packages, `SOFTURE_EMAIL_KEY_SECRET`, separate from `MAILING_UNSUBSCRIBE_SECRET`: the
  unsubscribe secret rotates, this one must not (a new value orphans every stored key, and the stores keep no
  address to re-key from).
- PBKDF2-HMAC-SHA256: password = the normalized address, salt = `softure.email-key.v1:` + secret, 10 000
  iterations, 32 bytes, base64url. ~2 ms per key; the secret is the protection, the iterations are depth for a
  leaked secret. Memoized (`memoizeByContent`, 10 000 entries) so a campaign pays once per address.
- A missing or short secret throws a `ConfigError`-style `Error` naming the variable: a configuration bug, raised at
  the first key, like other required config.
- The functions keep their names and gain an optional `env` (default `process.env`), like
  `readUnsubscribeSecrets`.
- Migration `0006` drops `mailing.recipient_key`, `mailing.is_suppressed`, `mailing.was_delivered`; the views stay;
  the README shows the replacement (keys from `getRecipientKey`, `= ANY($1)`). Stored rows are not touched: the
  owner ruled out a transition, and deleting opt-outs is not reversible.
- Tests get the secret from `vitest.config.mts` (main process, every worker), the e2e from the Playwright configs.
- Breaking for 0.x: mailing 0.3.0, privacy 0.3.0, waitlist patch; dependents' ranges widened.

## Phases

1. mailing: derivation, callers, migration 0006, env list (code and module.json), README, CHANGELOG, tests.
2. privacy: derivation, env list, README, CHANGELOG, tests; waitlist: tests, README, CHANGELOG.
3. Example app: env in `.env.example` and both Playwright configs; vitest config.

## Acceptance

- `npx vitest run modules/mailing modules/privacy modules/waitlist` green; a new test pins the derivation and the
  missing-secret error.
- `npm run typecheck`, `npm run lint` green; no `createHash` left on an address.
- CodeQL on the pull request reports no `js/insufficient-password-hash`; after the merge alert #97 is fixed and the
  workflow closes #1418.

## Progress

- [x] Phase 1 and 2 (a562f36): mailing and privacy derive the key with PBKDF2 under `SOFTURE_EMAIL_KEY_SECRET`;
      migration 0006; list mail, previews, `runDeliveries` and `softure-mail campaign` refuse without the secret;
      pinned-derivation and missing-secret tests in both packages, the waitlist equality test under a second secret.
      `npx vitest run modules/mailing modules/privacy modules/waitlist`: 59 files, 1052 tests passed.
      `npx vitest run modules/alerts modules/auth modules/billing tests/repo`: green apart from the two
      container-only repository tests that fail on master too (no `ssh-keygen`, an `rm` guard on `PATH`).
- [x] Phase 3 (d4fa970): the example app's `.env.example`, both Playwright configs and the two specs that key an
      address; READMEs (mailing §1, §5, §6, §11; privacy §5, §6; waitlist §6) and CHANGELOGs under `Unreleased`.
      `npm run typecheck` and `npm run lint` green; no `createHash` on an address left in mailing or privacy.
