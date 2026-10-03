# Backlog: roadmap-marketing-kit (videos, screenshots and OG images from JSON and a brand)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-03).
That file holds the order, dependencies, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly
one place: here, in `context/changes/` or in `context/archive/`.

## Taking an entry

When an item becomes active work, move its entry and let `softure-new` write the real `change.md`:

```bash
git mv context/backlog/roadmap-marketing-kit/<id>/change.md context/changes/<id>/backlog-input.md
```

Then remove the empty folder here. Relative links in the moved file lose one `../`. The roadmap row goes
to `in_progress` (WORKFLOW §5.1).

## When it can start

The roadmap was promoted on 2026-10-03, when roadmap-monetization closed; EN-9 and MO-6 came with it as
carried-over owner items. Inside it, the order comes from dependencies:

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| EN-9 | [`engagement-release`](engagement-release/change.md) | Engagement modules release (carried over) | the owner at the keyboard (batch on 2026-10-05) | owner |
| MO-6 | [`monetization-release`](monetization-release/change.md) | Monetization modules release (carried over) | the owner at the keyboard (batch on 2026-10-05) | owner |
| MK-1 | [`mk-core-port`](../../archive/2026-10-03-mk-core-port/change.md) (archived) | Port the FIRE video core | roadmap promoted | start |
| MK-2 | [`mk-config-contract`](../../archive/2026-10-03-mk-config-contract/change.md) (archived) | Config contract: marketing.json and brand | MK-1 on main | dependency |
| MK-3 | [`mk-declarative-actions`](mk-declarative-actions/change.md) | Declarative scene actions | MK-2 on main | dependency |
| MK-7 | [`mk-tts-adapters`](../../archive/2026-10-03-mk-tts-adapters/change.md) (archived) | TTS provider adapters | MK-2 on main | dependency |
| MK-6 | [`mk-formats`](mk-formats/change.md) | Render formats 1:1 and 16:9 | MK-2 on main | dependency |
| MK-4 | [`mk-screenshots`](../../changes/mk-screenshots/backlog-input.md) (in progress) | Screenshots with quality gates | MK-2 on main | dependency |
| MK-5 | [`mk-og-images`](mk-og-images/change.md) | OG images outside Next | MK-2 on main | dependency |
| MK-8 | [`marketing-kit-release`](marketing-kit-release/change.md) | marketing-kit release | MK-3…MK-7 on main **and** the owner approves the first npm publish | dependency + owner |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

When the last entry is taken, delete this folder.
