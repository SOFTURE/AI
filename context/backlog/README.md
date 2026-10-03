# Backlog

Everything planned for "later", and nothing that is in flight (WORKFLOW §5.1 in `@softure-ai/skills`).

## One topic, one place

| Folder | What lives there |
| --- | --- |
| `context/changes/` | only what the **main** roadmap (`foundation/roadmap.md`) is delivering now |
| `context/backlog/roadmap-<slug>/` | prepared entries of a **queued** roadmap (`foundation/roadmaps/roadmap-<slug>.md`) |
| `context/archive/` | delivered or rejected |

An entry is never in two places, neither as a copy nor as a pointer.

- **Taking an entry:** `git mv context/backlog/roadmap-<slug>/<id>/change.md context/changes/<id>/backlog-input.md`,
  remove the empty folder, then `softure-new <id>` writes the real `change.md`. Relative links in the moved
  file lose one `../`.
- **An entry done or rejected elsewhere:** move it into that change's archive folder as `backlog-input.md`.
- **Loose findings** (deferred review items, ideas without a roadmap) go to `context/backlog/<topic>.md`
  as `- [ ] <date> <source>: <finding> (<severity>) <evidence>`.
- **Gaps and unfinished parts found while delivering a roadmap** become items of the catch-all
  [`roadmap-followups/`](roadmap-followups/) (owner, 2026-10-03), which runs last: see its README, "Adding a gap".

## Queued roadmaps

| Folder | Roadmap | Starts when |
| --- | --- | --- |
| [`roadmap-monetization/`](roadmap-monetization/) | [monetization](../foundation/roadmap.md) | promoted 2026-10-03 (main roadmap) |
| [`roadmap-marketing-kit/`](roadmap-marketing-kit/) | [marketing-kit](../foundation/roadmaps/roadmap-marketing-kit.md) | FD-1 and FD-2 done; any time after |
| [`roadmap-followups/`](roadmap-followups/) | [followups](../foundation/roadmaps/roadmap-followups.md) | every module roadmap done; promoted last |
