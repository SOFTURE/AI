# Research: bump-softure-packages-2026-11-27

## What 0.41.2 changes (diff of the published tarballs 0.41.1 and 0.41.2)
- `skills/softure-doctor/scripts/context_state.py`: a queued roadmap no longer adds a `word` entry
  ("start queued roadmap ...") to `owner_queue`; it is listed only under `queued`.
- `WORKFLOW.md` §5.1, §8.6 and §12.1 say the same.
- Nothing else: no skill text, no managed-block text, no routine, no script besides the state writer.

## What it means here
- `context/state.json` on master has `queued: []` and `owner_queue: []`; the project has no queued roadmap, so the
  regenerated file is expected to be identical.
- The managed block of `AGENTS.md` comes from `rules/`, which did not change.

## Upgrade steps the release asks for
- Regenerate `context/state.json` (`npx softure-skills state`) and run the doctor. Nothing for the owner.
