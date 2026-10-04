# Plan review: waitlist-welcome-html

Reviewed: plan.md against change.md, research.md and the roadmap item FU-4 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 3 warning, 1 suggestion.

## Lenses

- Outcome coverage: an HTML welcome mail next to the text one, an option for the app's template,
  the unknown (template shape) answered; unit and e2e tests named.
- Contracts: the template's input (union on `kind`), the strict options schema, mailing's
  validation of `html` and its footer on list mail; the e2e's reliance on the text link.
- Security: copy in HTML, the link in an `href`.
- Failure paths: a template that throws or returns nothing, inside `after()`.

## Findings

### W1 [WARNING] A template that uses `paragraphs` can emit unescaped copy
**Where:** `WaitlistMailTemplateInput.paragraphs`.
**Problem:** a copy override with `<` or `&` reaches the HTML raw when the app's template inserts
the plain paragraphs itself.
**Decision:** Accepted - the copy is the app's own, `body` is the safe default to wrap, the type's
doc comment says `paragraphs` are plain text, and `escapeHtml` is exported for templates; a unit
test pins that the default body escapes an override with markup.

### W2 [WARNING] A throwing template loses the confirmation mail without a visible error to the person
**Where:** `deliverConfirmationMail` in the join action's `after()`.
**Problem:** the form says "check your inbox" and no mail arrives.
**Decision:** Accepted - a throwing template is a bug in the app's code; Next logs the error, and
catching it to send the default would hide the bug behind an off-brand mail. README §3 states it.

### W3 [WARNING] The e2e reads the confirmation link from the text body
**Where:** Phase 2, `readConfirmationLink`.
**Problem:** if the HTML link drifted from the text one, the e2e would not notice.
**Decision:** Fixed in the plan - Phase 2 asserts that the anchor's `href` equals the text link.

### S1 [SUGGESTION] Allow an async template
**Decision:** Rejected - a mail template needs no I/O; an app that renders a React component
can use a synchronous renderer, and an async variant can be added without breaking the sync one.

## Progress mechanics

One `## Progress`, last; phase titles match; gates items last in their phases.

## Triage summary

All warnings decided; nothing pending.
