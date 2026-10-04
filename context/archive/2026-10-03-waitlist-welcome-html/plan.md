# Plan: waitlist-welcome-html

Input: change.md, research.md. Complexity: small (2 phases). Risk: low (mail bodies only, no data).

## Goal

- `waitlist({ mailTemplate })`: optional `(mail: WaitlistMailTemplateInput) => string`, refused
  at startup when not a function.
- `WaitlistMailTemplateInput`: a union on `kind`: `welcome` (`locale`, `subject`, `paragraphs`,
  `body`) and `confirmation` (the same plus `action: { href, label }`). `paragraphs` are plain
  text; `body` is the default HTML fragment (escaped).
- Default HTML: each paragraph of the copy (split on blank lines, single line breaks as `<br>`)
  escaped in `<p>`; the confirmation link as `<p><a href="…">label</a></p>` after the text.
- `deliverWelcomeMail` and `deliverConfirmationMail` send `html` (the app's template, else the
  default) next to the unchanged `text`; a blank template result throws an error naming
  `mailTemplate` and the kind.
- Messages `en`/`pl`: `confirmationMail.action`.
- `escapeHtml` exported from `@softure-ai/waitlist/server` for templates.
- README §3, §9, §12 updated; the §12 text-only line removed.
- Example app: a `mailTemplate` that wraps `body` in a small branded document; e2e asserts both
  mails' HTML.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Template shape | a synchronous function returning a string | mailing takes a string; no React rendering in the server path | research, unknown 1 |
| Scope | both mails, one option with `kind` | one brand layout for both (coordinator default) | change.md Notes |
| Without a template | a default HTML body | auth precedent; mailing's footer becomes a link | research |
| Link placement | by code, label from copy | an override cannot drop the link (auth precedent) | research |
| Blank template result | throw (a bug) | errors convention: exceptions for bugs; silent refusal hides it | research, risks |
| Text body | unchanged | e2e and clients without HTML read it; the link stays its last line | research |

Rejected: a React component option (needs `react-dom/server` and mail-safe components); an option
only on the welcome mail (the confirmation mail would look different from the app's brand).

## Phase 1: Module

**Discipline:** TDD.

- Tests first: default HTML of both mails (exact strings), template input and output, escaping of
  an override with markup, the welcome HTML carries mailing's footer, a blank result throws, the
  option refuses a non-function, messages parity.
- `src/server/mail-html.ts`; options; both mail functions; messages; exports; README.

## Phase 2: Example app and e2e

- `examples/next-app/softure.config.ts`: `mailTemplate` wrapping `body` in a document with the
  example's name.
- `e2e/waitlist.spec.ts`: the confirmation mail's HTML has the layout and an anchor whose `href`
  equals the text link; the welcome mail's HTML has the layout and mailing's unsubscribe anchor.

## Risks and rollback

No migration. Rollback: revert the commits; apps that set `mailTemplate` must drop it (the
strict options schema refuses unknown keys).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [x] 1.1 Waitlist tests for the default HTML, the template, escaping and the option pass — c4331b1
- [x] 1.2 Gates green (typecheck, lint, test) — c4331b1

### Phase 2: Example app and e2e

#### Automated
- [x] 2.1 Gates green (typecheck, lint, test, build) — 1aaa24e
- [x] 2.2 `npm run e2e` passes, including the changed tests in `e2e/waitlist.spec.ts` — 1aaa24e

#### Manual
- [x] 2.3 Impl review recorded in `reviews/impl-review.md` — 1aaa24e
