---
change_id: reports-hourly-config
status: planned
---

# Plan: hourly status reports in the configuration

Input: change.md (research skipped, see Notes). Complexity: trivial (one configuration value).

## Phase 1: configuration

File: `context/workflow.json`.

1. `autonomy.reports.every`: 30 → 60; `autonomy.reports.hours`: `"10:00-22:30"` → `"10:00-22:00"`.
2. Done when: the file parses as JSON
   (`node -e 'JSON.parse(require("fs").readFileSync("context/workflow.json","utf8"))'`); a grep for `every": 30`
   and `22:30` outside `node_modules/` and `context/archive/` finds only the managed block of `AGENTS.md` and the
   history; `npm run lint` and `npx vitest run tests/repo` green.

## Progress

- [ ] Phase 1: configuration
