# Plan: charts-followups-close

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Goal

charts-followups lives in `context/foundation/archive/2026-10-07-2-roadmap.md` with every item `done`, a Summary
with merge SHAs and settled owner checks; its backlog folder is gone; `context/foundation/roadmap.md` states that no
roadmap runs and work goes through GitHub Issues; every index points at the archive; repository tests stay green.

## Key decisions

- **Keep `roadmap.md` as a "no active roadmap" note** instead of deleting it. The contract test, the skills
  (`softure-new` places a change by reading it) and links across `context/` expect the file; a note with no table
  passes the contract (zero rows, zero blocks) and tells the next session where work comes from. The test stays
  unchanged. Alternative rejected: delete the file and make the test optional, which breaks links and leaves the
  skills without an answer.
- **Archive name `2026-10-07-2-roadmap.md`**: charts already took `2026-10-07-roadmap.md` (same-day counter rule).
- **CF-1 to `done`**: its only wait, the charts 0.1.1 release, is over.
- **Links**: the charts archive and CF-1's archived change pointed at `../roadmap.md` for charts-followups; they now
  point at the new archive file.
- **New gaps**: the backlog README says a gap becomes a GitHub issue while no roadmap runs.

## Phase 1: Close the roadmap

- `git mv` the roadmap into the archive, set `status: done`, CF-1 `done`, settled owner checks, Summary.
- Remove `context/backlog/roadmap-charts-followups/`.
- Write the "no active roadmap" `roadmap.md`.
- Update `context/foundation/roadmaps/README.md`, `context/backlog/README.md`, `README.md`, the charts archive and
  CF-1's archived change.

Done when: `grep -rn "charts-followups" context README.md` shows only archive and history mentions; `npm test --
tests/repo`, `npm run lint` and `npm run typecheck` are green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Close the roadmap

#### Automated
- [x] 1.1 Roadmap archived with Summary, backlog folder removed, indexes and links updated — 7ea07f2
- [x] 1.2 "No active roadmap" note in `roadmap.md` — 7ea07f2
- [x] 1.3 Repository tests, lint and typecheck green — 7ea07f2
