---
project: "SOFTURE AI"
roadmap: none
version: 1
status: idle
prd_version: 2
created: 2026-11-16
updated: 2026-11-17
---

# No active roadmap

No roadmap runs now. Work is driven by GitHub Issues: each issue becomes one change (`context/changes/<change-id>/`,
the full softure chain) with `roadmap_item: null`, its pull request closes the issue, and the change is archived in
`context/archive/` as usual. A new main roadmap replaces this file only when roadmaps resume.

- Last main roadmap: [`runtime-providers`](archive/2026-11-16-roadmap.md) (`RP-`), closed on 2026-11-16.
- Queued roadmaps: none. The last one, [`later`](archive/2026-11-17-roadmap.md) (`LT-`), closed on 2026-11-17.
- Every archived roadmap: [`archive/`](archive/).

## Owner decisions and checks

- [ ] Owner step: (2026-11-20) when an adopting app turns on off-site backups (`@softure-ai/backup`, the
  `offsite-backup` step of `@softure-ai/deploy` maintain), create the provider bucket and its tokens, generate the age
  key and save them as that app's GitHub Environment secrets; steps in `modules/backup/README.md`, "Owner guide".
  Only the owner holds the provider account and the app's secrets. Source: #1410 (closed, carried here), from item 4.3
  of [`archive/2026-11-09-backup-offsite-1210/plan.md`](../archive/2026-11-09-backup-offsite-1210/plan.md).
