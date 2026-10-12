---
change_id: release-policy-docs
title: "Docs describe releases as the coordinator's batch call (release.owner: false)"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-pg8a6x
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

`context/workflow.json` sets `release.owner: false`, and the managed block of `AGENTS.md` (Releases) says the
coordinator then releases once per wave through the project's pipeline. Several documents still say the
opposite: agents never tag or publish, and a release waits for the owner's word. A reader (human or agent)
following those documents would hold back releases the configuration allows. Bring them in line with
`workflow.json`, which is the source of truth.

Requested by the owner on 2026-10-12 in the project chat: `workflow.json` is right, the README is wrong. Releases
are the coordinator's decision, made without asking; changes are collected and released as one combined batch
once the current issues are done, never one release per change. A production deploy still waits for the owner.

## Context

Found by one grep for release and owner wording outside `node_modules/` and `context/archive/`:

- `README.md:75`: "Agents never tag or publish; the owner does."
- `scripts/release/README.md:13-16`: "Releases are the owner's call … an agent starts one only on the owner's
  explicit word".
- `docs/02-module-standard.md:342-343`: "An agent releases only on the owner's explicit word, through
  `auto-release.yml` (`release.owner: true`)", which also misquotes the configured value.
- `context/foundation/shape-notes.md:93`: no-go "No releases or deploys by agents. The owner tags releases."
- `.github/workflows/auto-release.yml:9`: header comment "When it may run: on the owner's explicit word".
- `context/foundation/roadmaps/roadmap-later.md:40-44`: run-wide orders "Tags and npm publishes stay with the
  owner" and "the owner releases at the keyboard".

`AGENTS.md`, `CLAUDE.md` (imports `AGENTS.md`) and the installed skills already branch on `release.owner`, so they
agree with the configuration.

## Constraints

- Documentation only: no workflow behaviour, script or test changes (the workflow file gets a comment edit).
- Archived changes under `context/archive/` are history: untouched.
- The installed skills come from `@softure-ai/skills` (another repository): untouched.
- No release in this change.

## Notes

- Research: skipped. The whole surface is the six documents above, found by one grep; the target rule is
  already written in `AGENTS.md` (Releases) and `workflow.json`.
- Framing: skipped. The owner named the problem and the fix.
