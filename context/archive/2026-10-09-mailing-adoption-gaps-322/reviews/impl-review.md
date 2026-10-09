# Implementation review: mailing-adoption-gaps-322

Reviewed the diff against change.md and plan.md (an independent reviewer pass, then the fixes below). Mode:
autonomous (decisions taken, recorded here). Package tests, typecheck and lint green after the fixes.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `runDeliveries` with list mail and no `MAILING_UNSUBSCRIBE_SECRET` claimed every recipient, each send failed `unavailable` without giving its attempt back, and after `maxAttempts` runs every recipient was closed as rejected with nothing sent; the dry run did not show it. | Fixed: the run throws at the first list mail without the secret, before any claim, in a real and a dry run. Tested. |
| F2 | Warning | The pasted-link guard matched the bare route path (`/unsubscribe?`), so a link to another site's unsubscribe page was refused. | Fixed: it matches the app's origin plus its routes, and the signed `r=…&t=` pair anywhere. Tested. |
| F3 | Warning | `softure-mail test --preview` reads the secret from `runMailCli({ env })`, a real send from `process.env`. | Accepted as is: every send reads `process.env` (as the campaign did); the README says so. |
| F4 | Suggestion | The campaign dry run blamed the secret for any preview failure. | Fixed: it names invalid fields when the mail is invalid. |
| F5 | Suggestion | `redactUnsubscribeSignatures` also redacts unrelated `t=` parameters. | Accepted: it fails safe; the preview is for reading, not for clicking. |
| F6 | Suggestion | An SPF include with a trailing dot failed as `missing-include`. | Fixed and tested. |
| F7 | Suggestion | Two new private functions took four inputs. | Fixed: options objects. |
| F8 | Suggestion | Non-ASCII capitals key differently in SQL under the C locale. | Accepted: documented in the migration and the README. |
