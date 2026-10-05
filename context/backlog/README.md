# Backlog

Everything planned for "later", and nothing that is in flight (WORKFLOW §5.1 in `@softure-ai/skills`).

## One topic, one place

| Folder | What lives there |
| --- | --- |
| `context/changes/` | only what the **main** roadmap (`foundation/roadmap.md`) is delivering now |
| `context/backlog/roadmap-<slug>/` | prepared entries of a **queued** roadmap (`foundation/roadmaps/roadmap-<slug>.md`), and of the main roadmap until each is taken |
| `context/archive/` | delivered or rejected |

An entry is never in two places, neither as a copy nor as a pointer.

- **Taking an entry:** `git mv context/backlog/roadmap-<slug>/<id>/change.md context/changes/<id>/backlog-input.md`,
  remove the empty folder, then `softure-new <id>` writes the real `change.md`. Relative links in the moved
  file lose one `../`.
- **An entry done or rejected elsewhere:** move it into that change's archive folder as `backlog-input.md`.
- **Loose findings** (deferred review items, ideas without a roadmap) go to `context/backlog/<topic>.md`
  as `- [ ] <date> <source>: <finding> (<severity>) <evidence>`.
- **Gaps and unfinished parts found while delivering a roadmap** became items of the catch-all followups roadmap
  (owner, 2026-10-03), closed on 2026-10-04 ([archive](../foundation/archive/2026-10-04-roadmap.md)). New gaps go to
  the main roadmap's catch-all; the blog roadmap's was blog-followups (owner, 2026-10-03), the main roadmap from
  2026-10-05 until it closed the same day ([archive](../foundation/archive/2026-10-05-roadmap.md)). The deploy
  roadmap's catch-all is `roadmap-deploy-followups/` (`DF-`), created with its first gap (see the deploy roadmap's
  header). While no main roadmap runs, a new gap goes to a loose `<topic>.md` file.
- **Work that is ready but waits only on the owner at the keyboard** (repository secrets, a provider account)
  becomes an item of [`roadmap-later/`](roadmap-later/) (owner, 2026-10-03): see its README, "Adding an item".

## Queued roadmaps

| Folder | Roadmap | Starts when |
| --- | --- | --- |
| [`roadmap-charts/`](roadmap-charts/) | [charts](../foundation/roadmaps/roadmap-charts.md) | the owner promotes it |
| [`roadmap-deploy/`](roadmap-deploy/) | [deploy](../foundation/roadmap.md) | promoted 2026-10-05 (main roadmap; DP-1…DP-8) |
| [`roadmap-later/`](roadmap-later/) | [later](../foundation/roadmaps/roadmap-later.md) | the owner step each item waits on is done (MK-8, EN-9 and MO-6 carried over from followups; BL-8 from blog) |
