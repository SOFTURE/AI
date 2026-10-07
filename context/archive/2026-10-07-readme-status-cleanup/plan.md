# Plan: readme-status-cleanup

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Goal

No README outside `context/`, `docs/` and `tools/marketing-kit/` carries a status note, a wave, a roadmap item ID
used as a status, or a "first release" remark. Dependencies and every usage section stay.

## Key decisions

- **Keep `Depends on`**: it is reference data an installer needs, not status; it moves to its own line.
- **Keep FIRE_TRACKER provenance lines** ("Built from FIRE_TRACKER's …") and the charts adoption mapping: they
  tell an adopting app what each package replaces, which is current.
- **Keep sister repositories** in the root README.
- **Root roadmap table**: drop the dated "charts-followups, CF-1, since …" and "waits on owner steps"; they go stale
  with every roadmap switch.

## Phase 1: Remove the notes

- Edit the READMEs listed in change.md.

Done when: `grep -n "Status:\|wave [0-9]\|first release\|implementation starting"` over those READMEs returns
nothing; `npm test -- tests/repo` (relative links in every `*.md`) and `npm run lint` are green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Remove the notes

#### Automated
- [x] 1.1 Status notes and roadmap meta removed from the READMEs — 777fbdf
- [x] 1.2 Repository tests and lint green — 777fbdf
