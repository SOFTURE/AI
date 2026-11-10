# Plan: observability-memory-metrics

## Steps

1. `src/node/memory-metrics.ts`: `registerMemoryMetrics({ meter, cgroupDir?, readRss? })`, five observable gauges in
   one batch callback (unit `By`), read at collection; `readCgroupMemory(dir)` returns usage, working set
   (`memory.current - inactive_file`, floored at 0), limit (null for `max`) and swap, or null without a readable
   `memory.current`.
2. `start.ts`: register it on the meter provider unless `instrumentations.memory === false`; remove it at shutdown
   after the providers. `config.ts`: the option with its doc. `/node` exports `MEMORY_METRIC_NAMES`.
3. Tests: fixture cgroup directory (all files; `max` and no swap; missing directory; removed callback; malformed
   `memory.current`; `memory.stat` without the field or missing); `startObservability` exports
   `process.memory.usage` by default and not with the option off.
4. README (Metrics), CHANGELOG, version 0.8.3 (package.json and package-lock.json).

## Progress

- [x] 1 `memory-metrics.ts`.
- [x] 2 Wired in `startObservability`, option and export.
- [x] 3 `npx vitest run foundation/observability`: 16 files, 174 tests (before the last two added) green.
- [x] 4 README, CHANGELOG, 0.8.3.

## Decisions (auto)

- Patch bump (0.8.3), not 0.9.0: the change is additive, and a minor bump of a 0.x package would leave the dependents'
  `^0.8.x` ranges behind (backup, deploy) and force their releases for nothing.
- Working set as cAdvisor defines it (usage minus `inactive_file`): page cache counts in `memory.current` but is
  dropped before the OOM killer, so an alert on raw usage would fire on a harmless cache.
- No rule builder for the memory alert yet: the README gives the expression; one adopting app writes it by hand.
