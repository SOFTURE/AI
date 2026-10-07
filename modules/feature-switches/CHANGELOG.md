# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/feature-switches`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`feature-switches@x.y.z`).

## Unreleased

- `toSwitchPanelRows(views, messages, config)` and `describeSwitchSource` from `/next`: the panel's row mapping, for an app that builds the panel inside its own page shell; `getSwitchContext` from `/next` and `getFeatureSwitchesRoutes` from `/server` too.
- `setSwitchAction` revalidates `routes.panel` after a stored change, so the row's source note is fresh without a reload. An app that mounts its own panel page names its path in `featureSwitches({ routes: { panel } })`.
- `exportSwitchesUserData` and `deleteSwitchesUserData` take `{ db }` only. **Changed:** `deleteSwitchesUserData` returns `ok({ clearedSwitches })` instead of `ok()`; the privacy contributor still answers `ok()`.
- README: adopting an existing switches table (a checklist the test suite runs with `baseline: { "feature-switches": 1 }`), changing a switch from SQL, and the Vitest `server.deps.inline` setting for tests that import `/next`.

## 0.1.6

- `override: "towards-fail-mode"` on a switch: its environment variable can move it only to the fail-mode value; the other value is ignored and logged once.
- Adapters use the configured database handle; `@softure-ai/ui` is a peer dependency.
