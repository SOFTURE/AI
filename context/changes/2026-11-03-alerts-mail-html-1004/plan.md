---
change_id: alerts-mail-html-1004
status: in_progress
---

# Plan: mailChannel sends an HTML part next to the text (issue #1004)

Input: change.md, research.md. Complexity: small (one package, two source files and a new one, tests, docs).

## Phase 1: rendered parts, the HTML layout and the exports

1. Tests first (red on master): `tests/mailing.test.ts` checks that a rendered delivery mails a text and an HTML
   part; the HTML has the severity badge (green for `resolved`), the title, the details list (`- ` items with
   indented sub-lines), the repeats line and the link button; every value is escaped; `html: () => undefined` sends
   text only; an `html` function replaces the layout; a hand-built delivery without `parts` sends text only;
   `getAlertIdempotencyKey` and `toMailChannelResult` are exported and behave as the channel does.
2. `channels.ts`: `AlertDeliveryParts { tag, title, details, repeats, link }` and `AlertDelivery.parts?`.
3. `server/render.ts`: fills `parts` from the same copy as the text.
4. `mailing/html.ts`: `renderAlertMailHtml(delivery)` and the details parser; `mailing/index.ts`: `html` option
   (default `renderAlertMailHtml`), exports `getAlertIdempotencyKey`, `toMailChannelResult`, `renderAlertMailHtml`.
5. `index.ts`: export `AlertDeliveryParts`.

## Phase 2: docs

README mail channel row and a short HTML paragraph; CHANGELOG `## Unreleased` (minor: new option, new exports, HTML
part on by default; what an app with its own HTML channel can drop).

## Decisions (auto)

- HTML on by default: the issue's phone case is the common one; `html: () => undefined` turns it off.
- `parts` optional on the type: a hand-built delivery stays valid and simply mails text only.
- Raw hex colours inline in the mail layout: mail clients ignore stylesheets and CSS variables, so design tokens do
  not reach them; the colours are named constants in one place.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
