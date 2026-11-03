---
change_id: alerts-mail-html-1004
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (d6bf07b).

- Scope: all three proposals of the issue are covered: an `html` option with a default layout, the `details` line
  convention, and exported idempotency key and error mapping.
- Compatibility: the text part, the subject, the idempotency key and every chat channel are unchanged; `parts` is
  optional, so app code that builds an `AlertDelivery` by hand keeps compiling.
- Safety: titles and details are free text and go into the HTML escaped; the link is already an `http(s)` URL from
  `alert()` and is escaped as an attribute too.
- Copy: the layout uses only the pieces `renderAlert` builds from the app's message dictionary, so an app's own
  translation reaches the HTML part.

Verdict: approved, no changes.
