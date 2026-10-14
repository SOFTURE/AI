---
change_id: deploy-policy-docs
title: "Docs say a production deploy follows the release without waiting for the owner"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-s7ecju
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

The owner gave standing approval for production deploys on 2026-10-14 in the project chat: a deploy never waits
for the owner's word, it runs right after the release. Several documents still say a production deploy always
waits for the owner. A reader (human or agent) following them would hold back a deploy the owner has already
approved. Bring them in line with the decision.

## Context

Found by one grep for deploy and owner wording outside `node_modules/` and the archives:

- `README.md:77-78`: "A production deploy always waits for the owner's word."
- `scripts/release/README.md:18-19`: "A production deploy is not a release and always waits for the owner's word."
- `context/foundation/shape-notes.md:93`: no-go "No deploys by agents without the owner's word."
- `AGENTS.md` (managed block, Operating mode and Releases): a production deploy waits for the owner's word. The block
  is installed by `@softure-ai/skills` and must not be edited here; the block itself says project-specific rules
  outside it take precedence, so the project rule goes in the project part of `AGENTS.md`.

## Constraints

- Documentation only: no workflow, script or test changes.
- The managed block of `AGENTS.md` and the installed skills come from another repository: untouched.
- Archived changes and done roadmap lines are history: untouched.
- No release and no deploy in this change.

## Notes

- Research: skipped. The whole surface is the four documents above, found by one grep; the target rule is the
  owner's decision of 2026-10-14.
- Framing: skipped. The owner named the problem and the fix.
