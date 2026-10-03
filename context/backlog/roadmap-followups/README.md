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
| FU-1 | [`switch-reader-contract`](switch-reader-contract/change.md) | Switch-reader contract in core | roadmap promoted | start |
| FU-2 | [`waitlist-double-opt-in`](waitlist-double-opt-in/change.md) | Waitlist double opt-in | FU-3 on main | dependency |
| FU-4 | [`waitlist-welcome-html`](waitlist-welcome-html/change.md) | HTML welcome mail for the waitlist | FU-2 on main | dependency |
| FU-5 | [`analytics-client-navigation`](analytics-client-navigation/change.md) | Channel tag on client navigations without Next-Url | roadmap promoted | start |
| FU-6 | [`billing-reminder-mail`](billing-reminder-mail/change.md) | Reminder mail before access ends | FU-9 on main | dependency |
| FU-7 | [`analytics-action-redirect-tag`](analytics-action-redirect-tag/change.md) | Channel tag kept through server action redirects | FU-1 and FU-5 on main | dependency |
| FU-8 | [`waitlist-funnel-hook`](waitlist-funnel-hook/change.md) | Waitlist sign-ups as a funnel step | FU-4 on main | dependency |
| FU-12 | [`billing-retro-reviews`](billing-retro-reviews/change.md) | Retro research and plan review for MO-1 and MO-2 | roadmap promoted | start |
| FU-13 | [`marketing-kit-render-ci`](marketing-kit-render-ci/change.md) | The marketing-kit fixture film renders in CI | roadmap promoted | start |
| FU-14 | [`marketing-kit-schema-docs`](../../archive/2026-10-03-marketing-kit-schema-docs/change.md) | The marketing.json JSON Schema documents every key | archived 2026-10-03 | start |
| FU-15 | [`marketing-kit-desktop-16x9`](marketing-kit-desktop-16x9/change.md) | A 16:9 film can show the desktop app in a browser frame | FU-16 on main | dependency |
| FU-16 | [`marketing-kit-layout-overrides`](marketing-kit-layout-overrides/change.md) | A project can adjust a format's layout in marketing.json | FU-14 on main | dependency |
| FU-17 | [`marketing-kit-og-glyphs`](marketing-kit-og-glyphs/change.md) | OG images refuse copy the brand fonts cannot draw | roadmap promoted | start |
| FU-18 | [`marketing-kit-screenshot-variants`](marketing-kit-screenshot-variants/change.md) | Screenshots at a device scale and in both colour schemes | FU-14 on main | dependency |
| FU-19 | [`marketing-kit-hook-shot-words`](marketing-kit-hook-shot-words/change.md) | Opening shots after the first name their word in the config check | FU-14 on main | dependency |
| FU-20 | [`billing-partial-refunds`](billing-partial-refunds/change.md) | Partial refunds take back access by a policy | FU-11 on main | dependency |
| FU-21 | [`billing-refund-manual-lifetime`](billing-refund-manual-lifetime/change.md) | A manual lifetime grant survives a refunded paid lifetime | FU-9 on main | dependency |
| FU-22 | [`billing-grant-plan-script`](billing-grant-plan-script/change.md) | A `grant-plan` ops script for hosts without the admin page | FU-21 on main | dependency |

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
