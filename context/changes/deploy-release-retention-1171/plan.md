---
change_id: deploy-release-retention-1171
status: in_progress
---

# Plan: release retention and server cleanup (issue #1171)

Input: change.md, research.md. Complexity: medium (schema, CLI, server script, docs).

## Phase 1: the setting

- `src/verify/schema.ts`: `releases: { keep: int 2..50, default 5 }` (`DEFAULT_RELEASE_KEEP`); regenerate
  `schema/deploy.schema.json`.
- `server-settings` writes `release-keep`; `templates/deploy.json.tmpl` writes `"releases": { "keep": 5 }`;
  regenerate `e2e/app`.
- Tests: schema accepts 2 and rejects 1, 0, 51 and a non-integer; server-settings writes the value and the default.

## Phase 2: deploy.sh

- `load_settings` reads `release-keep` (no-database apps call the CLI when `deploy.json` has `hooks` or `releases`).
- The deploy prunes `releases/` after the `settings` step with the release's keep, never the previous tag's folder.
- One `clean_up <keep> <commit>` function: steps `releases`, `images`, `tools-images`, `dangling`, `build-cache`,
  each `step|<name>|ok|removed N …` or `would remove N …`, sizes summed per distinct image id.
- `cleanup [--keep=N] [--commit]` (lock, env, settings, `plan`, `disk-before`, the steps, `disk-after`, result line);
  `maintain` runs the same steps with commit.
- Tests: dry run removes nothing and lists the plan; `--commit` with keep N; running and rollback images survive;
  another repository's image is never touched; tools images other than the script's go; bad arguments are refused;
  maintain applies the release keep.

## Phase 3: CLI and docs

- `softure-deploy cleanup --host=<ssh host> [--port] [--ssh] [--keep=N] [--commit]` (remote-command.ts, run.ts usage).
- README (server cleanup section, deploy.json setting, maintain description), CHANGELOG 0.6.0 entry.

## Decisions (auto)

- Minimum keep is 2: the rollback target must stay on the host; maximum 50.
- Threshold for dangling images and build cache: 24 hours, fixed.
- The build cache and dangling images are host-wide by nature; they are the only things outside this app's
  repositories the cleanup touches, as the issue asks. Another app's tools image is rebuilt on its next use.
- Sizes are "about": layers shared between images are counted once per image.
- The version bump (0.6.0) rides this pull request: no other deploy change is open or unreleased, so the release
  follows its merge directly.
- A no-database app whose deploy.json has `releases` but no hooks now runs the CLI at the settings step (option 1 of
  research.md); the changelog says so.

## Progress

- [x] Phase 1: the setting (schema, server-settings, init template, e2e app regenerated)
- [x] Phase 2: deploy.sh (`npx vitest run tests/server-files.test.ts`: 122 passed)
- [x] Phase 3: CLI and docs (`tests/remote-cli.test.ts`: 37 passed; README "Server cleanup", CHANGELOG 0.6.0)
- [x] Implementation review: approved
