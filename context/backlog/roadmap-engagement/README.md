# Backlog: roadmap-engagement (mail, waitlist, MCP access and privacy)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-03):
order, dependencies, owner decisions and the status of every item.

This folder holds the **prepared entries** (`<change-id>/change.md`, `status: backlog`). One topic lives in
exactly one place: `backlog/`, `changes/` or `archive/`, never copied and never as a pointer stub (WORKFLOW §5.1).

## When it can start

The roadmap was promoted on 2026-10-03, when roadmap-identity closed. Inside it, the order follows the dependencies below.

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| EN-1 | [`mailing-transport`](../../archive/2026-10-03-mailing-transport/change.md) (archived) | Mail transport with provider adapters | roadmap promoted | start |
| EN-2 | [`mailing-unsubscribe`](../../archive/2026-10-03-mailing-unsubscribe/change.md) (archived) | Signed one-click unsubscribe and suppressions | EN-1 on the main branch | dependency |
| EN-3 | [`mailing-ledger-campaigns`](../../archive/2026-10-03-mailing-ledger-campaigns/change.md) (archived) | Delivery ledger and campaigns | EN-2 on the main branch | dependency |
| EN-4 | [`auth-reset-via-mailing`](../../archive/2026-10-03-auth-reset-via-mailing/change.md) (archived) | Password reset mails through the mailing module | EN-1 on the main branch | dependency |
| EN-5 | [`waitlist`](waitlist/change.md) | Waitlist with consent scopes | EN-1, EN-2 and EN-8 on the main branch | dependency |
| EN-6 | [`mcp-access`](../../archive/2026-10-03-mcp-access/change.md) (archived) | MCP access tokens and Bearer endpoint | roadmap promoted | start |
| EN-7 | [`privacy-registry`](../../archive/2026-10-03-privacy-registry/change.md) (archived) | GDPR export and deletion registry | roadmap promoted | start |
| EN-8 | [`privacy-consents-legal`](privacy-consents-legal/change.md) | Consent records and legal document shell | EN-7 on the main branch | dependency |
| EN-9 | [`engagement-release`](engagement-release/change.md) | Engagement modules release | EN-3 to EN-8 on the main branch, and the owner at the keyboard | owner |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

## Taking an entry

1. `git mv context/backlog/roadmap-engagement/<change-id>/change.md context/changes/<change-id>/backlog-input.md`
   and remove the empty folder. Relative links in the moved file lose one `../`.
2. `softure-new <change-id>` writes the real `change.md` (status `new`) from `backlog-input.md`.
3. Set the item's row and block in the roadmap to `in_progress (…)`.

When the last entry is taken, delete this folder.
