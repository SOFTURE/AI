# Backlog: roadmap-marketing-kit (videos, screenshots and OG images from JSON and a brand)

Roadmap of this group: [`foundation/roadmaps/roadmap-marketing-kit.md`](../../foundation/roadmaps/roadmap-marketing-kit.md).
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

The whole roadmap starts **after FD-1 (monorepo tooling) and FD-2 (release pipeline) are done**, when the
owner promotes it (`softure-roadmap --promote marketing-kit`). It is independent of the module roadmaps.
Inside it, the order comes from dependencies:

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| MK-1 | [`mk-core-port`](mk-core-port/change.md) | Port the FIRE video core | roadmap promoted | start |
| MK-2 | [`mk-config-contract`](mk-config-contract/change.md) | Config contract: marketing.json and brand | MK-1 on main | dependency |
| MK-3 | [`mk-declarative-actions`](mk-declarative-actions/change.md) | Declarative scene actions | MK-2 on main | dependency |
| MK-7 | [`mk-tts-adapters`](mk-tts-adapters/change.md) | TTS provider adapters | MK-2 on main | dependency |
| MK-6 | [`mk-formats`](mk-formats/change.md) | Render formats 1:1 and 16:9 | MK-2 on main | dependency |
| MK-4 | [`mk-screenshots`](mk-screenshots/change.md) | Screenshots with quality gates | MK-2 on main | dependency |
| MK-5 | [`mk-og-images`](mk-og-images/change.md) | OG images outside Next | MK-2 on main | dependency |
| MK-8 | [`marketing-kit-release`](marketing-kit-release/change.md) | marketing-kit release | MK-3…MK-7 on main **and** the owner approves the first npm publish | dependency + owner |
