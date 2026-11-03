---
change_id: alerts-mail-html-1004
verdict: approved
---

# Implementation review

Reviewed the diff of 52622ef..f20f809 against plan.md and the issue's proposals.

- `renderAlert` fills `parts` from the same copy and values as the text; the text, the subject and the webhook
  payload (which lists its fields explicitly) are unchanged, so chat channels and existing tests see the same output.
- `renderAlertMailHtml`: single column, `max-width:600px`, inline styles only, badge colour by kind (`resolved`
  green, `test` grey) or else by severity; title, subject in `<title>`, details, repeats line and link label are
  escaped as text, the link URL as an attribute (`&` to `&amp;`). A delivery without `parts` yields no HTML, so a
  hand-built delivery mails text only, as before.
- `parseAlertDetails`: `- ` items, indented sub-lines, paragraphs, blank lines end a list; an indented line with
  no list before it is a paragraph. Tests cover mixed, plain and empty input.
- `mailChannel({ html })`: default layout, the app's own function, or `() => undefined` for text only; tested.
- Exports `getAlertIdempotencyKey` and `toMailChannelResult` are the same functions the channel uses (renamed from
  the private ones); a test pins the key the channel sends to the export.
- Literal colours in the mail layout are named constants with the reason in the file comment (mail clients drop
  stylesheets and CSS variables).
- Gates: typecheck, ESLint and the language gate pass (pre-commit); the alerts suite passes (9 files, 82 tests).
- Docs: README channel row and an HTML paragraph with the details convention; CHANGELOG Unreleased with what an app
  with its own HTML channel can drop.

Verdict: approved.
