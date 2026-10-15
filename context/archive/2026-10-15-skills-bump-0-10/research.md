# Research: skills-bump-0-10

Input: change.md. Depth: quick.
Snapshot: 7537f15 on claude/project-thread-pajn7v, 2026-10-15 14:50 CEST.

## Summary

npm has 0.9.0 (2026-10-14) and 0.10.0 (2026-10-15). A diff of the 0.8.0 and 0.10.0 tarballs shows text-only
changes: `rules/AGENTS.md`, `WORKFLOW.md`, `README.md` and three skills (`softure-init`, `softure-worktree`,
`softure-worktree-manager`, which gains `references/report-routine.md`). The installer scripts are unchanged, and
`workflow.json` gains no new key.

## What the new version adds

- Autonomous block: "Start of a run" for a coordinator with nothing in flight; the coordinator closes finished
  threads itself; a coordinator without a scheduling tool creates the report routine through a setup thread
  (`softure-worktree-manager/references/report-routine.md`); gaps in `@softure-ai/skills` are filed in
  SOFTURE/SKILLS, other packages in SOFTURE/AI; an owner's correction of the process becomes a SOFTURE/SKILLS issue.
- WORKFLOW §8.5 "Hosted projects": the hosted coordinator gets a one-paragraph pointer to `AGENTS.md` in the
  project instructions; a table maps every worktree step to its hosted equivalent.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Dependency | `package.json`, `package-lock.json` | version range and lock |
| Rules | `AGENTS.md` (managed block) | the installer rewrites it |

## Requirements on this repository

- None in the repository itself: no new `workflow.json` key, no new file the block points to, the report routine
  already exists. The §8.5 pointer belongs in the hosted project's instructions, which only the owner edits.
- `tests/repo/` checks links in every `*.md`; the managed block is checked like the rest of `AGENTS.md`.

## Risks

- The project's own "Production deploys" section above the block keeps overriding the block's release rule. Low.

## Decisions (auto)

- Target 0.10.0 (latest), range `^0.10.0`.
