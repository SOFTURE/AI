# Research: alerts-mail-html-1004

## Current state (master d6bf07b)

- `modules/alerts/src/mailing/index.ts`: `mailChannel({ to, sender?, minSeverity?, quietHours? })` calls
  `sendMail({ config }, { to, subject, text, sender? }, { idempotencyKey })`. `getIdempotencyKey` (sha256 of channel,
  key, kind, at) and `toChannelResult` (mailing codes to alerts codes, `retryAfterSeconds` kept) are private.
- `modules/mailing` `sendMail` accepts `html?: string` next to `text` (campaigns pass it already).
- `modules/alerts/src/server/render.ts` `renderAlert` builds `AlertDelivery { channel, message, subject, text }` from
  the app's copy (severity, tag per kind, plural repeats line, `open` label). The channel sees only the delivery, so
  an HTML layout that wants the same copy (tag, repeats line, link label) has to get it from the delivery.
- `AlertMessage.link` is validated as an `http(s)` URL in `alert()`; `title` and `details` are free text. Everything
  goes into HTML escaped.

## Options

1. The mail channel derives the HTML from `delivery.text` (split lines). Fragile: it cannot tell the repeats line or
   the link line from details. Rejected.
2. `renderAlert` adds the rendered pieces to the delivery: `parts: { tag, title, details, repeats, link: { label,
   url } }`, optional on the type so hand-built deliveries stay valid. The mail channel's default layout
   (`renderAlertMailHtml(delivery)`, exported from `/mailing`) builds the HTML from `parts`; without `parts` it sends
   text only. Chosen: the copy stays in one place, app layouts get the same pieces.
3. `renderAlert` renders the HTML itself for every channel. Rejected: HTML is the mail channel's envelope, and chat
   channels would carry a string they never use.

## Details convention

Lines of `details` that start with `- ` are list items; following lines indented by spaces or a tab are sub-lines of
that item; other lines are paragraphs. The text part keeps the raw details, which already read as a list.

## Files

- `modules/alerts/src/channels.ts` (`AlertDelivery.parts`, `AlertDeliveryParts`)
- `modules/alerts/src/server/render.ts` (fills `parts`)
- `modules/alerts/src/mailing/index.ts`, new `modules/alerts/src/mailing/html.ts`
- `modules/alerts/src/index.ts` (type export)
- `modules/alerts/tests/mailing.test.ts`, `modules/alerts/tests/channels.test.ts` or alert tests for `parts`
- `modules/alerts/README.md`, `modules/alerts/CHANGELOG.md`
