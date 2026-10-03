# Backlog: roadmap-followups (gaps found while delivering the other roadmaps)

Roadmap of this group: [`foundation/roadmaps/roadmap-followups.md`](../../foundation/roadmaps/roadmap-followups.md):
order, dependencies, owner decisions and the status of every item.

This folder holds the **prepared entries** (`<change-id>/change.md`, `status: backlog`). One topic lives in
exactly one place: `backlog/`, `changes/` or `archive/`, never copied and never as a pointer stub (WORKFLOW §5.1).

## When it can start

The whole roadmap: **every module roadmap is done and the owner promotes it last**. A new gap found in any roadmap
gets an entry here and a row in the roadmap.

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| FU-1 | [`switch-reader-contract`](switch-reader-contract/change.md) | Switch-reader contract in core | roadmap promoted | start |
| FU-2 | [`waitlist-double-opt-in`](waitlist-double-opt-in/change.md) | Waitlist double opt-in | roadmap promoted | start |
| FU-3 | [`mailing-consent-sync`](mailing-consent-sync/change.md) | Unsubscribe as consent withdrawal | roadmap promoted | start |
| FU-4 | [`waitlist-welcome-html`](waitlist-welcome-html/change.md) | HTML welcome mail for the waitlist | roadmap promoted | start |
| FU-6 | [`billing-reminder-mail`](billing-reminder-mail/change.md) | Reminder mail before access ends | roadmap promoted | start |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

## Adding a gap

Any thread that finds a gap or leaves part of its item undone (a review finding it defers, a README
"Limitations" line, an owner check it cannot close) records it here in the same change, not in a loose file:

1. Take the next free `FU-<n>` and a kebab-case change-id.
2. Write `<change-id>/change.md` like the entries above (`status: backlog`, the item block quoted in Context,
   **Source** naming the roadmap item and the evidence `file` or section).
3. Add the row to the table here and the row plus item block to
   [`roadmap-followups.md`](../../foundation/roadmaps/roadmap-followups.md) (status `proposed`; severity in **Risk**).

## Taking an entry

1. `git mv context/backlog/roadmap-followups/<change-id>/change.md context/changes/<change-id>/backlog-input.md`
   and remove the empty folder. Relative links in the moved file lose one `../`.
2. `softure-new <change-id>` writes the real `change.md` (status `new`) from `backlog-input.md`.
3. Set the item's row and block in the roadmap to `in_progress (…)`.

When the last entry is taken, delete this folder.
