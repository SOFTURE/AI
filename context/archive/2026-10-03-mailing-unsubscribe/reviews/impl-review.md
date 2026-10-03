# Implementation review: mailing-unsubscribe

Reviewed: commits 3617d97 (p1), f55b835 (p2) and the review fixes against plan.md (author's
review plus an independent review pass, `--auto`). Verdict: approve. Findings: 0 critical,
3 warnings, 1 suggestion; W1 to W3 fixed.
Evidence: gates green (typecheck, lint, 1247 unit tests, build); `npm run e2e` on PostgreSQL 16:
41 passed, including the four tests of `e2e/mailing-unsubscribe.spec.ts`.

## Drift from plan

- The one-click route answers 400 for a link that does not verify (FIRE answered 200): the
  signature check reveals nothing about suppression state, and a 400 helps diagnosis.
- `e2e/ops.spec.ts` and `scripts/container.mjs` list the new mailing health check.

## Findings

### W1 [WARNING] CodeQL: incomplete escaping in two test expectations
**Where:** `tests/send-mail.test.ts`, `e2e/mailing-unsubscribe.spec.ts`
**Decision:** Fixed - `replaceAll("&", "&amp;")`.

### W2 [WARNING] The HTML footer could land inside `</body>`
**Where:** `src/server/list-mail.ts`
**Problem:** the position came from `html.toLowerCase()`, which can be longer than the original
(`İ` lowercases to two characters).
**Decision:** Fixed - the last `</body>` is matched case-insensitively on the original string;
a test covers it.

### W3 [WARNING] `/next` sendMail opened the database for transactional mail
**Where:** `src/next/send-mail.ts`
**Problem:** a database that cannot be opened would make a password reset throw.
**Decision:** Fixed - the handle is fetched for list mail only; a test registers an unopenable
database URL and still sends transactional mail.

### S1 [SUGGESTION] Type `MailContext` by kind, so list mail without `db` fails to compile
**Decision:** Defer - the runtime throw is documented and tested; a discriminated context would
complicate every transactional caller for a wiring bug the first test run catches.
