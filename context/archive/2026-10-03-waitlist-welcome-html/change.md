---
change_id: waitlist-welcome-html
title: "The waitlist's mails carry an HTML body the app can template"
status: archived
roadmap_item: FU-4
branch: claude/project-thread-lsci7g
created: 2026-10-03
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

The waitlist's welcome mail goes out with an HTML body next to its text body, and an app can
render that HTML body with its own template (`waitlist({ mailTemplate })`), for example to put
its brand layout around the copy. Without a template the module sends a plain HTML body built from
the same copy. The confirmation mail of double opt-in gets the same treatment, with its link as an
anchor. Unit tests and the example app's e2e cover the default and an app template.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-4).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-4** (roadmap `followups`):

> - **Outcome:** An option for the app's HTML template of the waitlist welcome mail, next to the text version.
> - **Unknowns:** Template shape (function of locale and links vs. a component).
> - **Risk:** LOW.
> - **Baseline:** engagement EN-5 `waitlist`: the welcome mail is text only (README §12). After: the gap is closed and covered by unit and e2e tests.

Today: `deliverWelcomeMail` (`modules/waitlist/src/server/welcome-mail.ts`) sends list mail with
`subject` and `text` from `messages.welcomeMail`; `deliverConfirmationMail`
(`server/confirmation-mail.ts`, FU-2) sends transactional mail whose text ends with the link.
Mailing already takes `html` and adds its unsubscribe footer to an HTML list mail
(`modules/mailing/src/server/list-mail.ts`).

## Constraints

- Owns `modules/waitlist/` (mail code, options, messages, README), the example app's waitlist
  config and `e2e/waitlist.spec.ts`.
- Lane B: FU-8 (funnel hook) follows in `modules/waitlist/`; it is not done here. Other gaps found
  go to the followups roadmap as new FU items.
- English-only code; user-facing copy only in the `en`/`pl` message dictionaries.
- No release, tag or publish (owner).

## Notes

- The confirmation mail gets HTML too (coordinator's default, for consistency): one template
  serves both mails, so an app's brand layout cannot cover one and miss the other.
- Framing skipped: a tightly scoped recorded gap with a stated outcome and no premise to test
  (the module already sends both mails; only their body format changes). Research answers the
  one unknown.
- Archived 2026-10-04: both waitlist mails carry an HTML body built from their copy, and `waitlist({ mailTemplate })` lets the app render it in its own layout.
