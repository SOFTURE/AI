---
change_id: deploy-notes-roadmap-auto
---

# Research: release-notes --roadmap=auto (issue #465)

## Current state (master 137d991)

- `tools/deploy/src/cli/release-notes-command.ts`: `readShippingItems(flag, cwd)` reads `resolve(cwd, flag)`; a
  missing file fails through `readText` ("cannot read … (ENOENT)"). No other lookup.
- `tools/deploy/src/notes/git.ts`: `findPreviousTag`, `readReleaseCommits`, `resolveCommit`, all through
  `execFileSync("git", args)` and `isSafeRef`.
- `tools/deploy/src/notes/roadmap-items.ts`: `parseRoadmapItems` + `selectShippingItems` (status `done_code`).
- Callers: no workflow template in this repository passes `--roadmap`; only the README, the CLI usage text
  (`src/cli/run.ts`) and the CLI tests mention it. The adopting app's release workflow is its own file.
- Archive layout: `context/foundation/archive/2026-10-03-roadmap.md`, `2026-10-03-2-roadmap.md`, … (this repository
  follows it too).

## Approach

- New git reads in `git.ts`:
  - `listAddedFiles({ cwd, from, to, dir })`: `git diff --name-only --relative --diff-filter=A <from> <to> -- <dir>`;
    with `from === null`, `git ls-tree -r --name-only <to> -- <dir>`. Paths relative to `cwd`.
  - `readFileAt({ cwd, ref, path })`: `git show <ref>:./<path>`.
- New module `notes/roadmap-files.ts`: `ARCHIVED_ROADMAP` pattern, `sortArchivedRoadmaps` (date, then counter).
- Command: `--roadmap=auto` → main file in `cwd` if it exists, else archived ones added in `from..to`, read at `to`.

## Risks

- `git diff A B` with `--diff-filter=A` lists a file added then removed inside the range? No: diff compares the two
  trees, so a file absent at `to` is not listed. Good, it is not there to read either.
- Path spec and `--relative` keep a release run from a subdirectory working; the release job runs at the root anyway.
