# Backlog: roadmap-followups (gaps found while delivering the other roadmaps)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-03):
order, lanes, dependencies, owner decisions and the status of every item.

This folder holds the **prepared entries** (`<change-id>/change.md`, `status: backlog`). One topic lives in
exactly one place: `backlog/`, `changes/` or `archive/`, never copied and never as a pointer stub (WORKFLOW §5.1).

## When it can start

The roadmap was promoted last on 2026-10-03, when roadmap-marketing-kit closed; MK-8, EN-9 and MO-6 came with it as
carried-over owner items. A new gap found in any roadmap gets an entry here and a row in the roadmap. Items that
share files run in one lane (see the roadmap's Order), so `dependency` below names the item before it in its lane.

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| EN-9 | [`engagement-release`](engagement-release/change.md) | Engagement modules release (carried over) | the owner at the keyboard (batch on 2026-10-05) | owner |
| MO-6 | [`monetization-release`](monetization-release/change.md) | Monetization modules release (carried over) | the owner at the keyboard (batch on 2026-10-05) | owner |
| MK-8 | [`marketing-kit-release`](marketing-kit-release/change.md) | marketing-kit release (carried over) | the owner at the keyboard (batch on 2026-10-05) | owner |
| FU-5 | [`analytics-client-navigation`](../../archive/2026-10-03-analytics-client-navigation/change.md) | Channel tag on client navigations without Next-Url | archived 2026-10-03 | start |
| FU-6 | [`billing-reminder-mail`](../../archive/2026-10-04-billing-reminder-mail/change.md) | Reminder mail before access ends | archived 2026-10-04 | dependency |
| FU-7 | [`analytics-action-redirect-tag`](../../archive/2026-10-03-analytics-action-redirect-tag/change.md) | Channel tag kept through server action redirects | archived 2026-10-04 | dependency |
| FU-12 | [`billing-retro-reviews`](../../archive/2026-10-04-billing-retro-reviews/change.md) | Retro research and plan review for MO-1 and MO-2 | archived 2026-10-04 | start |
| FU-13 | [`marketing-kit-render-ci`](../../archive/2026-10-03-marketing-kit-render-ci/change.md) | The marketing-kit fixture film renders in CI | archived 2026-10-03 | start |
| FU-14 | [`marketing-kit-schema-docs`](../../archive/2026-10-03-marketing-kit-schema-docs/change.md) | The marketing.json JSON Schema documents every key | archived 2026-10-03 | start |
| FU-15 | [`marketing-kit-desktop-16x9`](../../archive/2026-10-04-marketing-kit-desktop-16x9/change.md) | A 16:9 film can show the desktop app in a browser frame | archived 2026-10-04 | dependency |
| FU-16 | [`marketing-kit-layout-overrides`](../../archive/2026-10-03-marketing-kit-layout-overrides/change.md) | A project can adjust a format's layout in marketing.json | archived 2026-10-03 | dependency |
| FU-17 | [`marketing-kit-og-glyphs`](../../archive/2026-10-03-marketing-kit-og-glyphs/change.md) | OG images refuse copy the brand fonts cannot draw | archived 2026-10-03 | start |
| FU-18 | [`marketing-kit-screenshot-variants`](../../archive/2026-10-04-marketing-kit-screenshot-variants/change.md) | Screenshots at a device scale and in both colour schemes | archived 2026-10-04 | dependency |
| FU-19 | [`marketing-kit-hook-shot-words`](../../archive/2026-10-04-marketing-kit-hook-shot-words/change.md) | Opening shots after the first name their word in the config check | archived 2026-10-04 | dependency |
| FU-20 | [`billing-partial-refunds`](../../archive/2026-10-04-billing-partial-refunds/change.md) | Partial refunds take back access by a policy | archived 2026-10-04 | dependency |
| FU-21 | [`billing-refund-manual-lifetime`](../../archive/2026-10-04-billing-refund-manual-lifetime/change.md) | A manual lifetime grant survives a refunded paid lifetime | archived 2026-10-04 | dependency |
| FU-22 | [`billing-grant-plan-script`](../../archive/2026-10-04-billing-grant-plan-script/change.md) | A `grant-plan` ops script for hosts without the admin page | archived 2026-10-04 | dependency |
| FU-23 | [`marketing-kit-og-subset-fonts`](../../archive/2026-10-04-marketing-kit-og-subset-fonts/change.md) | OG images use every subset file of a weight | archived 2026-10-04 | dependency |
| FU-24 | [`billing-existing-accounts`](../../archive/2026-10-04-billing-existing-accounts/change.md) | Existing accounts keep their access when billing is enabled | archived 2026-10-04 | dependency |
| FU-25 | [`billing-stripe-currency-units`](../../archive/2026-10-04-billing-stripe-currency-units/change.md) | Stripe charges the plan's price in every currency | archived 2026-10-04 | dependency |
| FU-26 | [`billing-guard-race-tests`](billing-guard-race-tests/change.md) | Billing guards and lock races are tested where they can fail | FU-25 on main | dependency |
| FU-27 | [`billing-invoice-request-hygiene`](billing-invoice-request-hygiene/change.md) | Invoice requests are stored before the owner hears of them and keep only what they need | FU-26 on main | dependency |
| FU-28 | [`auth-page-redirect-tag`](../../archive/2026-10-04-auth-page-redirect-tag/change.md) | A signed-in visitor's redirect from a tagged login page keeps the tag | archived 2026-10-04 | dependency |
| FU-29 | [`marketing-kit-font-files-description`](../../archive/2026-10-04-marketing-kit-font-files-description/change.md) | The marketing.json font files description admits subset files | archived 2026-10-04 | dependency |
| FU-30 | [`billing-failed-refund-access`](billing-failed-refund-access/change.md) | A refund that fails gives back the access it took | FU-27 on main | dependency |
| FU-31 | [`auth-require-user-redirect-tag`](../../archive/2026-10-04-auth-require-user-redirect-tag/change.md) | `requireUser`'s redirect to login keeps the channel tag | archived 2026-10-04 | dependency |
| FU-32 | [`billing-price-minor-units`](billing-price-minor-units/change.md) | A plan's price means the same amount on every runtime | FU-30 on main | dependency |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

## Adding a gap

Any thread that finds a gap or leaves part of its item undone (a review finding it defers, a README
"Limitations" line, an owner check it cannot close) records it here in the same change, not in a loose file:

1. Take the next free `FU-<n>` (numbers are never reused: FU-10 moved to `roadmap-later`) and a kebab-case change-id.
2. Write `<change-id>/change.md` like the entries above (`status: backlog`, the item block quoted in Context,
   **Source** naming the roadmap item and the evidence `file` or section).
3. Add the row to the table here and the row plus item block to
   [`roadmap.md`](../../foundation/roadmap.md) (status `proposed`; severity in **Risk**; **Mode** `owner` with a
   reason when it needs the owner at the keyboard, and a row in its "Owner at the keyboard?" table either way).

## Taking an entry

1. `git mv context/backlog/roadmap-followups/<change-id>/change.md context/changes/<change-id>/backlog-input.md`
   and remove the empty folder. Relative links in the moved file lose one `../`.
2. `softure-new <change-id>` writes the real `change.md` (status `new`) from `backlog-input.md`.
3. Set the item's row and block in the roadmap to `in_progress (…)`.

When the last entry is taken, delete this folder.
