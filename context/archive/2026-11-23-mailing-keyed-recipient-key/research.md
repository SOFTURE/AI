# Research: mailing-keyed-recipient-key

## Findings

- The alert: CodeQL `js/insufficient-password-hash` at `modules/mailing/src/server/unsubscribe-link.ts:58`
  (`createHash("sha256")` in `getRecipientKey`). Its sink is the input of any `crypto.createHash`/`createHmac`
  `update` whose algorithm is not a password hashing one (CodeQL `CryptoLibraries.qll`, `NodeJSCrypto::Apply`;
  `InsufficientPasswordHashCustomizations.qll`). An HMAC would be flagged the same way; `pbkdf2Sync` and `scrypt`
  are not modelled as weak operations. The alert's source path is not readable from this session (API 403).
- Callers of the key: mailing `suppressions.ts`, `deliveries.ts`, `campaigns.ts`, `import-deliveries.ts`,
  `unsubscribe-link.ts` (links); waitlist `import.ts`, `next/actions.ts`; privacy keeps its own copy
  (`consents.ts` `getEmailKey`, used by `copy-account.ts` and `consents-contributor.ts`). waitlist
  `unsubscribe.ts` passes `event.recipientKey` to privacy as `{ emailKey }`, so both keys must stay equal; a waitlist
  test asserts it.
- Stored shape: every table checks `^[A-Za-z0-9_-]{43}$` (mailing `suppressions`, `deliveries`; privacy
  `consents.email_key` via `EMAIL_KEY`). 32 bytes in base64url keep that shape: no schema change.
- SQL surface (mailing `0005`): `recipient_key(address)`, `is_suppressed(address)`, `was_delivered(scope, address)`
  compute the key in SQL. With a secret only the server holds they cannot; the views `delivery_outcomes` and
  `suppressed_recipients` stay. No package calls the functions (only the README example and `sql-surface.test.ts`).
- Cost of `pbkdf2Sync` SHA-256, 32 bytes, measured in this container: 1000 iterations 0.22 ms, 5000 0.99 ms,
  10000 2.2 ms. A campaign or an import computes one key per recipient, often twice; core's `memoizeByContent`
  removes the repeats.
- Both modules declare `runtimes: ["node", "workers"]`; workerd's `node:crypto` implements `pbkdf2Sync`.

## Options

1. Keyed PBKDF2 with a new shared secret (chosen by the owner): a leaked table or link cannot be reversed without the
   secret; the address-taking SQL functions go.
2. Unkeyed PBKDF2 or scrypt: still reversible from a list of addresses, only slower; no SQL either.
3. Keep SHA-256 and dismiss the alert: offered, declined by the owner.
