# Backlog: roadmap-charts-followups (gaps found while delivering the charts roadmap)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-07). That file holds the order, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly one place:
here, in `context/changes/` or in `context/archive/`.

## When it can start

The owner promoted the roadmap on 2026-10-07, when charts closed. The order comes from dependencies:

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| CF-1 | [`chart-pin`](../../archive/2026-10-07-chart-pin/backlog-input.md) (taken 2026-10-07) | Event pin | roadmap promoted | start |

## Taking an entry

```bash
git mv context/backlog/roadmap-charts-followups/<id>/change.md context/changes/<id>/backlog-input.md
```

Then remove the empty folder here. Relative links in the moved file lose one `../`. The roadmap row goes to
`in_progress` (WORKFLOW §5.1).

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

When the last entry is taken, delete this folder.
