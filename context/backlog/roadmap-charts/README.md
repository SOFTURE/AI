# Backlog: roadmap-charts (SVG chart primitives with accessibility guards)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-06).
That file holds the order, lanes, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly
one place: here, in `context/changes/` or in `context/archive/`.

## Taking an entry

When an item becomes active work, move its entry and let `softure-new` write the real `change.md`:

```bash
git mv context/backlog/roadmap-charts/<id>/change.md context/changes/<id>/backlog-input.md
```

Then remove the empty folder here. Relative links in the moved file lose one `../`. The roadmap row goes
to `in_progress` (WORKFLOW §5.1).

## When it can start

The owner promoted the roadmap on 2026-10-06, when deploy-followups closed. The order comes from dependencies:

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| CH-1 | [`charts-scale-ticks`](charts-scale-ticks/change.md) | Chart scales, ticks and nearest point | roadmap promoted | start |
| CH-2 | [`charts-svg-primitives`](charts-svg-primitives/change.md) | SVG chart primitives | CH-1 on master | dependency |
| CH-3 | [`ui-color-guards`](../../archive/2026-10-06-ui-color-guards/change.md) | Colour contrast and colour-vision guards | archived 2026-10-06 (done_code: waits for the release of `@softure-ai/ui` 0.1.6) | start |
| CH-4 | [`charts-palette-guard`](charts-palette-guard/change.md) | Series palette guard | CH-2 and CH-3 on master | dependency |
| CH-5 | [`charts-release`](charts-release/change.md) | Charts release | CH-1…CH-4 on master **and** the owner's `NPM_TOKEN` for the first npm publish | dependency + owner |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

When the last entry is taken, delete this folder.
