# Plan: release-policy-docs

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Goal

Every document outside `context/archive/` and `node_modules/` that describes who releases says what
`workflow.json` (`release.owner: false`) and `AGENTS.md` (Releases) say: the coordinator decides and releases
without asking, in one combined batch once the current issues are done, through `auto-release.yml`; a production
deploy still waits for the owner's word.

**Out of scope:** the release pipeline itself, the skills package, archived changes.

## Key decisions

- **Point at the source, do not restate it everywhere.** Each document names `release.owner` in
  `context/workflow.json` and keeps one sentence of the rule, so a later switch of the value does not leave six
  stale copies.
- **shape-notes.md**: the no-go is amended in place with the date of the decision, since shape notes record
  product decisions and this one changed.
- **roadmap-later.md**: the queued roadmap's run-wide orders follow the current rule, so an orchestrator that
  promotes it does not hold releases back.

## Phase 1: Align the documents

- Edit the six documents listed in change.md.

Done when: `grep -rn -i -E "owner's (call|explicit word)|agents never tag|owner (tags|releases at)|stay with the owner"`
over the tree (without `context/archive/`, `node_modules/` and this change folder) returns nothing;
`npm run lint` and `npm test -- tests/repo` (relative links, roadmap contract) are green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Align the documents

#### Automated
- [ ] 1.1 Release wording aligned with `release.owner: false` in the six documents
- [ ] 1.2 Grep from Done when returns nothing; lint and repository tests green
