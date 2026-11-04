---
change_id: observability-grafana-apply-1006
title: "observability applies Grafana alert rules and dashboards kept as code in the app (issue #1006)"
status: archived
roadmap_item: null
issue: [1006]
branch: claude/project-thread-q52jhj
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #1006](https://github.com/SOFTURE/AI/issues/1006): apps that export to Grafana keep alert rules (and a
dashboard) as JSON in their repository, and each one carries its own apply script. After this change:

1. `softure-observability grafana apply --rules <file> [--dashboard <file>] [--commit] [--paused]` and
   `applyGrafanaResources()` in `/node` apply them with `GRAFANA_URL` and `GRAFANA_TOKEN` from the environment: dry
   run by default; `--commit` creates the folder when missing, refuses when the named contact point does not exist,
   replaces the rule group in one `PUT` (`X-Disable-Provenance`), and upserts the dashboard;
2. the rules file has an exported schema (folder, receiver, group, rules) the app's tests can parse it with;
3. builders produce the three common rules (service silent, worker silent, warnings or errors in the logs) from the
   service names the app passes to `startObservability` / `registerObservability`;
4. `--paused` applies every rule paused.

## Context

Labels: `enhancement`, `pkg: observability`. Package: `foundation/observability` (0.5.0). Files: new
`src/node/grafana/*`, `src/cli/run.ts`, `src/node/index.ts`, README, CHANGELOG, tests. No adopting app is changed;
the issue's closing comment and the CHANGELOG describe the migration.

## Constraints

- Out of scope (issue): creating contact points or notification policies; vendors other than Grafana.
- The contact point is never created (it holds a personal address).
- English only; no project, service or vendor names baked in beyond the Grafana API itself.
- No version bump (the coordinator batches releases); CHANGELOG under `Unreleased`.

## Notes

- Framing: skipped. The issue names the gap, the commands and the API calls.
