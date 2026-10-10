---
change_id: config-trusted-publisher-release
status: archived
---

# Plan: config 0.1.1 through the trusted publisher

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Phase 1: version and docs

Files: `tools/config/package.json`, `package-lock.json` (version 0.1.1), `tools/config/CHANGELOG.md` (`## 0.1.1`),
`scripts/release/README.md` (how to verify a newly bound trusted publisher).

## Phase 2: release (after merge)

Run `auto-release.yml` on master with `config`; check the "Publish to npm" notice and `npm view
@softure-ai/config@0.1.1`.

## Progress

- [x] Phase 1: version 0.1.1, CHANGELOG, runbook note
- [ ] Phase 2: release (runs after the merge; result reported to the coordinator)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build`; the full `npm test` runs in pre-push.
