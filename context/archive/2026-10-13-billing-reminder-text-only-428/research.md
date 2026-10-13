# Research: billing-reminder-text-only-428

## Findings

- `modules/billing/src/mailing/reminder-mail.ts`: `AccessReminderMail = Pick<OutgoingMail, "subject" | "text"> & {
  readonly html: string }`; `SendAccessRemindersOptions.buildMail` returns `AccessReminderMail | null` (or a promise);
  `build` spreads the result into `{ to: reminder.email, ...mail }`.
- `modules/mailing/src/contract.ts:115`: `OutgoingMail.html?: string`. `validate-mail.ts:69` turns a missing `html`
  into `html: null`, and rejects an empty one; `send-mail.ts:143` passes `null` to the provider untouched.
- `modules/billing/tests/reminder-mail.test.ts`: the template tests use the fake provider's `sent` list, which records
  `html` as the provider got it.
- README (`modules/billing/README.md`, "The app's own template and scopes") says the template "returns
  `{ subject, text, html }`".
- `context.mail` is typed `AccessReminderMail`; the package's `renderAccessReminderMail` always fills `html`.

## Options

1. Make `AccessReminderMail.html` optional. Smallest diff, but `context.mail.html` becomes `string | undefined` for
   every template that reads it: a type break in a patch.
2. A separate return type for `buildMail` with `html` optional (chosen). Additive; the rendered mail keeps `html: string`.
