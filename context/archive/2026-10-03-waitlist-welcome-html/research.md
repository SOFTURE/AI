# Research: waitlist-welcome-html

Sources: `modules/waitlist` (welcome and confirmation mail, options, messages, README §3, §9, §12,
tests), `modules/mailing` (`OutgoingMail.html`, `validate-mail.ts`, `list-mail.ts`
`addHtmlFooter`, `send-mail.ts`, the `/testing` outbox), `modules/auth` (`mailing/reset-mail.ts`,
the only module mail with an HTML body, and its function options), `modules/mailing` campaigns
(operator HTML files), the example app's `softure.config.ts` and `e2e/waitlist.spec.ts`, archive
`2026-10-03-waitlist-double-opt-in` (FU-2).

## Summary

Send both waitlist mails with an HTML body built from the same copy: paragraphs from the text
(split on blank lines), escaped, and for the confirmation mail the link as an anchor with its own
label. An app replaces the HTML with a function option `waitlist({ mailTemplate })` that receives
the mail's kind, locale, subject, plain paragraphs, the link (confirmation only) and the default
body, and returns the HTML. A function, not a React component: the module renders no React on the
server today, mail HTML is a string for mailing, and a function covers a component too (the app can
call its own renderer inside it). The text body stays as it is; mailing adds its unsubscribe footer
to both bodies of the welcome mail.

## Current state

- `deliverWelcomeMail(ctx, signup)` → `deliverOnce(ctx, { scope, mail: { to, subject, text, kind: "waitlist" } })`;
  the copy comes from `getWaitlistMessagesIn(config, signup.locale).welcomeMail` (`subject`, `text`).
- `deliverConfirmationMail(ctx, signup, token)` → `sendMail` transactional; text is
  `confirmationMail.text + "\n\n" + link` (the e2e reads the link as the last text line).
- Mailing: `OutgoingMail.html?: string`; validation refuses a blank `html`; list mail gets
  `addHtmlFooter` (a `<p>` before the last `</body>`, or appended to a fragment); the fake provider
  and the file outbox keep `html` (`readMailOutbox` → `html: string | null`).
- Auth's reset mail always sends HTML: escaped paragraphs in `<p>`, the link as `<a>` with a
  translatable label (`resetMail.action`); the link is placed by code so a copy override cannot
  drop it. Its escaper is private (as is mailing's).
- Function options are parsed with `z.custom<T>((value) => typeof value === "function", "must be a function")`
  (auth `passwordReset.send`, `onRegistered`; mailing `onUnsubscribed`).

## Affected surface

- `src/options.ts`: `mailTemplate` (optional function).
- `src/server/mail-html.ts` (new): the template input type, `renderDefaultMailHtml`, the escaper
  (exported as `escapeHtml` for templates), `getMailHtml(config, input)` that applies the app's
  template and refuses a blank result.
- `src/server/welcome-mail.ts`, `src/server/confirmation-mail.ts`: pass `html`.
- Messages `en`/`pl`: `confirmationMail.action` (the anchor label).
- `src/server/index.ts` exports; README §3 (option row), §9 (copy), §12 (gap removed).
- Example app: a `mailTemplate` with a minimal brand layout; `e2e/waitlist.spec.ts` asserts the
  HTML of both mails (layout, anchor, mailing's footer).

## Data

None: no table or migration changes. Delivery ledger rows are unchanged.

## Tests

`tests/welcome-mail.test.ts` and `tests/confirmation.test.ts` assert the exact default HTML, an
app template (its input and its output), escaping of copy overrides with markup, the footer on the
welcome HTML, and a blank template result. `tests/module.test.ts`: the option refuses a non-function.
`tests/messages.test.ts` keeps `en`/`pl` parity (new key). E2e: both mails carry the example's
layout, the confirmation anchor equals the text link.

## Patterns to follow

Auth `renderPasswordResetMail` (paragraphs, anchor label from copy, link placed by code); mailing's
`addHtmlFooter` (works on a full document and on a fragment, so a template may return either).

## Prior work

EN-5 `waitlist` recorded the gap (README §12); FU-2 added the confirmation mail and left the HTML
decision to FU-4 (coordinator's note: HTML for the confirmation mail too unless research objects;
nothing found against it).

## SOFTURE modules

`@softure-ai/mailing` already carries HTML and its footer; nothing new is needed there.
`@softure-ai/ui` has no mail layout (its primitives are React components for pages).

## Risks

- A copy override is the app's own text but may contain `<`/`&`: always escaped in the default
  body. A template that uses `paragraphs` must escape them itself; the input says so and
  `escapeHtml` is exported. `body` is already safe HTML.
- A template that throws breaks the send: the welcome mail runs after the response (`after()`),
  so the sign-up still succeeds and the error is logged by Next, as with any bug in app code. A
  blank result is a bug too: the module throws an error naming the option and the mail kind instead
  of letting mailing refuse it silently.
- Link in HTML: `href` is the module's URL (`appOrigin` + route + base64url token), escaped anyway.

## Answers to unknowns

1. **Template shape:** a function `(mail) => string`, with `mail` a union on `kind`
   (`welcome` | `confirmation`) carrying `locale`, `subject`, `paragraphs`, `body` and, for
   `confirmation`, `action: { href, label }`. Synchronous: a mail template needs no I/O, and the
   welcome send is already async around it. A React component was rejected: rendering it needs
   `react-dom/server` in the module's server path and a mail-safe component set the project does
   not have; an app that wants one renders it inside the function.

## Open questions

None.

## Decisions (auto)

- One option for both mails (`mailTemplate`, with `kind`) rather than `welcomeMail.html`. → The
  confirmation mail gets HTML too (coordinator's default) and one template keeps the brand layout
  on both.
- HTML is always sent, a template only replaces it. → Auth's reset mail does the same; a list mail
  with an HTML part renders mailing's footer as a link.
