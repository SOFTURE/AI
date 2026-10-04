# Backlog: roadmap-later (items parked until an owner step is done)

Roadmap of this group: [`foundation/roadmaps/roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md):
order, dependencies, owner decisions and the status of every item.

This folder holds the **prepared entries** (`<change-id>/change.md`, `status: backlog`). One topic lives in
exactly one place: `backlog/`, `changes/` or `archive/`, never copied and never as a pointer stub (WORKFLOW §5.1).

## When it can start

Each item starts once the owner step it waits on is done (secrets, a provider account). The owner promotes the
roadmap or moves a single item into the main roadmap. An item ready to build that waits only on the owner at the
keyboard lands here (owner, 2026-10-03). MK-8, EN-9 and MO-6 moved here with their IDs when the followups roadmap
closed (2026-10-04).

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| LT-1 | [`billing-stripe-sandbox-e2e`](billing-stripe-sandbox-e2e/change.md) | Stripe sandbox payment end to end (was FU-10) | the owner's Stripe test-mode secrets in the repository (planned for 2026-10-05) | owner |
| EN-9 | [`engagement-release`](engagement-release/change.md) | Engagement modules release (carried over from followups) | the owner at the keyboard (batch on 2026-10-05) | owner |
| MO-6 | [`monetization-release`](monetization-release/change.md) | Monetization modules release (carried over from followups) | the owner at the keyboard (batch on 2026-10-05) | owner |
| MK-8 | [`marketing-kit-release`](marketing-kit-release/change.md) | marketing-kit release (carried over from followups) | the owner at the keyboard (batch on 2026-10-05) | owner |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

## Adding an item

1. Take the next free `LT-<n>` and a kebab-case change-id.
2. Write `<change-id>/change.md` like the entry above (`status: backlog`, the item block quoted in Context,
   **Prerequisites** naming the owner step it waits on).
3. Add the row to the table here and the row plus item block to
   [`roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md), with a `blocked (…)` status naming the owner step.

## Taking an entry

1. `git mv context/backlog/roadmap-later/<change-id>/change.md context/changes/<change-id>/backlog-input.md`
   and remove the empty folder. Relative links in the moved file lose one `../`.
2. `softure-new <change-id>` writes the real `change.md` (status `new`) from `backlog-input.md`.
3. Set the item's row and block in the roadmap to `in_progress (…)`.

When the last entry is taken, delete this folder.
