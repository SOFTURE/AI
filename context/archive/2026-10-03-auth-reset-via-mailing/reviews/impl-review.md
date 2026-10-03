# Implementation review: auth-reset-via-mailing

Reviewed: 5b9a6a1 against plan.md (author's review, `--auto`). Verdict: approve.
Findings: 0 critical, 0 warnings, 2 suggestions.

## Checks

- Plan coverage: the `./mailing` subpath, optional peer, `mailingResetSender()`,
  `renderPasswordResetMail()`, `resetMail` copy in en + pl, README sections 1, 2, 4, 9 and 10, the
  example wiring and `e2e/auth-reset-mail.spec.ts` are in. Nothing out of scope was touched;
  `modules/mailing/` is unchanged.
- Security: every HTML value is escaped (test with a hostile override and link); the thrown error
  carries only the `mailing.*` code; the link is placed by code, so an override cannot drop it.
- Gates: typecheck, lint, test (1182) and build green. `npm run e2e` against PostgreSQL 16: every
  reset and mail scenario passes (the ID-5 scenarios now read links from the mail outbox). One
  run had `auth.spec.ts` "the login-account limit" time out under full parallel load (eleven
  scrypt logins); the spec passes on its own and the change does not touch login.

## Findings

### S1 [SUGGESTION] Mail in `next dev` without MAIL_OUTBOX disappears
**Decision:** Defer - the fake provider keeps it in memory, as EN-1 decided; set `MAIL_OUTBOX`
or `RESEND_API_KEY` to see reset mail locally.

### S2 [SUGGESTION] Fail at startup when `mailingResetSender()` is used without `mailing()`
**Decision:** Defer - auth cannot see the sender's needs at parse time without a declared
dependency; the first send fails with mailing's own "module is not enabled" error, logged.
