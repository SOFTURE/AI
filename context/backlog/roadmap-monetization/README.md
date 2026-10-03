# Backlog: roadmap-monetization (billing and channel analytics)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-03):
order, dependencies, owner decisions and the status of every item.

This folder holds the **prepared entries** (`<change-id>/change.md`, `status: backlog`). One topic lives in
exactly one place: `backlog/`, `changes/` or `archive/`, never copied and never as a pointer stub (WORKFLOW §5.1).

## When it can start

The roadmap was promoted on 2026-10-03, when roadmap-engagement closed; MO-3 still waits for the owner's provider
decision. Inside it, the order follows the dependencies below.

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| EN-9 | [`engagement-release`](engagement-release/change.md) | Engagement modules release (carried over from engagement) | the owner at the keyboard | owner |
| MO-2 | [`billing-plans-pricing`](../../changes/billing-plans-pricing/change.md) (taken) | Plans, pricing tiles and the manual payment flow | MO-1 on the main branch | dependency |
| MO-3 | [`billing-provider-adapter`](billing-provider-adapter/change.md) | Payment provider adapter | MO-2 on the main branch and the owner's provider decision | owner |
| MO-4 | [`analytics-channel-tags`](../../archive/2026-10-03-analytics-channel-tags/change.md) (archived) | Channel tags | roadmap promoted | start |
| MO-5 | [`analytics-funnel`](analytics-funnel/change.md) | Cookieless funnel counter | MO-4 on the main branch | dependency |
| MO-6 | [`monetization-release`](monetization-release/change.md) | Monetization modules release | MO-2 and MO-5 on the main branch, and the owner at the keyboard | owner |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

## Taking an entry

1. `git mv context/backlog/roadmap-monetization/<change-id>/change.md context/changes/<change-id>/backlog-input.md`
   and remove the empty folder. Relative links in the moved file lose one `../`.
2. `softure-new <change-id>` writes the real `change.md` (status `new`) from `backlog-input.md`.
3. Set the item's row and block in the roadmap to `in_progress (…)`.

When the last entry is taken, delete this folder.
