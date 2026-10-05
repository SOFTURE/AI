---
change_id: release-0-1-1
title: "Every package moves to 0.1.1, the first version that is actually released"
status: archived
roadmap_item: null
branch: claude/project-thread-wa8tm8
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

All 16 public packages go from 0.1.0 to 0.1.1 (package.json, module.json, the inline module manifests,
both lockfiles, README status lines), so `auto-release` can tag and release them from a `master` that
carries the `release-gates-postgres` fix. Internal ranges stay `^0.1.0`, which accepts 0.1.1.

## Context

The 0.1.0 release (auto-release run 37335587576) created the 16 tags on 69b743a and every release run
stopped at its test gate (no Postgres in the release job). Nothing was published. A re-run on those tags
would use their old `release.yml` and fail again, and this session may not move a tag. The owner was
offered new versions (recommended) or deleting the tags; the work follows the recommendation until the
owner says otherwise.

## Constraints

- Owns: version fields of the 16 packages, `package-lock.json`, `examples/next-app/package-lock.json`,
  README status lines, `scripts/release/README.md` (first batch section), the owner check in
  `context/foundation/roadmaps/roadmap-later.md`, `tests/repo/release-tags.test.ts`.
- No range changes; no code changes beyond the version strings.

## Notes

- Placement: no main roadmap in flight; continues the owner's first release (BL-8, MK-8, EN-9, MO-6).
- Research and framing skipped: a mechanical version bump of an already reviewed release.
- LT-2 (`release:version` does not update inline manifests) does not block this bump: the inline
  manifests were changed by hand, and the module tests check them against module.json.
- `tests/repo/release-tags.test.ts` read the repository's own core version as a literal; it now reads it
  from package.json, so the next bump does not break it.
