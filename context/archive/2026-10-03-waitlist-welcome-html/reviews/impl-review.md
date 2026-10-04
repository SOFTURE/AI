# Implementation review: waitlist-welcome-html

Reviewed: commits c4331b1 and 1aaa24e against plan.md (author's review, `--auto`).

## Verdict

Approve. Findings: 0 critical, 2 warning, 1 suggestion.
Evidence: gates green (typecheck, lint with the language gate, `npm test`: 2319 passed, build);
`npm run e2e` on PostgreSQL 16: 84 of 84 passed, the seven waitlist specs among them.

## Dimensions

Correctness (default body, template input, locale), security (escaping of copy, the link in an
`href`), failure paths (a throwing or blank template inside `after()`), docs.

## Plan coverage

Every Goal line is implemented and tested: the option and its refusal of a non-function
(`tests/module.test.ts`), the default HTML of the welcome mail with mailing's footer and of the
confirmation mail with its anchor (exact strings), escaping and line breaks of an override, the
template's input in the sign-up's locale and its output with the footer inside `<body>`, a blank
result throwing with nothing sent (`tests/welcome-mail.test.ts`, `tests/confirmation.test.ts`),
messages parity including `confirmationMail` (`tests/messages.test.ts`), README §1, §3, §9 and §12,
and the example app's layout asserted on both mails in `e2e/waitlist.spec.ts` (the anchor equals the
text link, the welcome footer sits before `</body>`).

Drift: `escapeHtml` and the template types are exported from the package root, not `/server`: the
template is written in `softure.config.ts`, which imports the root; the function is pure.

## Findings

### W1 [WARNING] A template only sees the default copy split into paragraphs
**Where:** `splitParagraphs`.
**Problem:** copy with its own structure (a list written as lines) arrives as one paragraph with
line breaks; a template cannot tell a heading from a paragraph.
**Decision:** Kept - the copy is plain text by contract (the text body is the same copy); single
line breaks become `<br>`, and an app that needs structure writes it in its template.

### W2 [WARNING] A blank copy override yields an empty default body
**Where:** `renderDefaultMailBody` with a copy of only whitespace.
**Problem:** mailing refuses a blank `html`.
**Decision:** Kept - mailing refuses the blank `text` of the same copy anyway
(`mailing.invalid_input`), so no new failure mode; message overrides are validated nowhere else either.

### S1 [SUGGESTION] Export the default renderer for templates that want different paragraphs
**Decision:** Rejected for now - `body` already carries it; exporting `renderDefaultMailBody` would
freeze its signature without a user.

## Progress audit

All Progress items checked with their commit SHA.

## Triage summary

Nothing pending.
