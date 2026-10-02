# Backlog: roadmap-identity (who the user is, what they may do, how the app runs)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-02).
It holds the owner decisions, the order, the dependencies and the status of every item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`): the prepared
intent, context and constraints of each item. One topic lives in one place only (WORKFLOW §5.1):
an entry is in `backlog/`, `changes/` or `archive/`, never in two of them and never as a pointer stub.

## When it can start

The owner promoted this roadmap on 2026-10-02 (`context/foundation/roadmap.md` is now identity, with
FD-8 of foundation carried over). Inside, the order follows the dependencies:

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| ID-1 | [`next-actions-spike`](../../archive/2026-10-02-next-actions-spike/change.md) (archived) | Server actions and route handlers from a package | roadmap promoted | start |
| ID-2 | [`security-rate-limit`](../../archive/2026-10-02-security-rate-limit/change.md) | Rate limiting module | roadmap promoted | start |
| ID-3 | [`auth-core`](auth-core/change.md) | Authentication core | ID-1 and ID-2 on main | dependency |
| ID-4 | [`auth-roles`](auth-roles/change.md) | Roles and admin | ID-3 on main | dependency |
| ID-5 | [`auth-password-reset`](auth-password-reset/change.md) | Password reset by token | ID-4 on main | dependency |
| ID-6 | [`feature-switches`](feature-switches/change.md) | Feature switches module | ID-4 on main | dependency |
| ID-7 | [`ops-health-migrate`](../../changes/ops-health-migrate/change.md) (in progress) | Health and migrate step | ID-1 on main | dependency |
| ID-8 | [`identity-release`](identity-release/change.md) | Identity release | ID-2…ID-7 on main **and** the owner publishes | owner |
| ID-9 | [`fire-adopt-identity`](fire-adopt-identity/change.md) | FIRE_TRACKER adopts the identity modules | ID-8 published **and** the owner starts it in FIRE_TRACKER | owner |

## Taking an entry

When an item becomes active work:

```bash
mkdir -p context/changes/<change-id>
git mv context/backlog/roadmap-identity/<change-id>/change.md context/changes/<change-id>/backlog-input.md
rmdir context/backlog/roadmap-identity/<change-id>
```

Then `softure-new <change-id>` writes the real `change.md` (status `new`) from it. Relative links
in the moved file lose one `../`. Set the item's row in the roadmap to `in_progress`.
When every entry has been taken, this folder is removed.
