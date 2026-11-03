---
change_id: release-version-dev-ranges-982
status: done
---

# Research: devDependencies ranges in release:version (issue #982)

## Findings

- `scripts/release/release-rules.mjs` `DEPENDENCY_FIELDS = ["dependencies", "peerDependencies",
  "optionalDependencies"]`; `checkInternalRanges` is used by `version.mjs` (all workspaces, the new version
  substituted) and by `checkManifest` (`release:pack`, the tagged package only).
- npm links a workspace only when the dependent's range accepts the workspace version; for devDependencies too
  (all workspaces install dev deps). Otherwise it installs the registry copy nested under the dependent, which is
  what the issue observed (`modules/agent-ready/node_modules/@softure-ai/deploy@0.4.10`).
- Measured on master 1f92ca9: 35 workspaces, no devDependencies range rejects its workspace version; the lockfile
  `packages` map has no `*/node_modules/@softure-ai/*` entry and every `node_modules/@softure-ai/*` entry is
  `link: true`. So adding devDependencies to the shared check and a lockfile test is green today.
- Lockfile v3 shape: `packages["node_modules/@softure-ai/core"] = { resolved: "foundation/core", link: true }`; a
  registry copy has `version`, `resolved: "https://registry.npmjs.org/..."`, `integrity`, no `link`.

## Options

1. devDependencies in `DEPENDENCY_FIELDS` (refuse) — the issue's first ask. Warning only would let the break through.
2. Lockfile guard after `npm version`: a pure `findRegistryWorkspaceCopies(lock, workspaceNames)` that lists
   entries whose key ends in `node_modules/@softure-ai/<workspace>` and are not links. `version.mjs` compares the
   lockfile before and after `npm version`; a new entry → restore tracked files, tell to run `npm ci`, fail.
3. A repository test over the committed lockfile with the same function, so a release commit with a registry copy
   fails CI even if made by hand.

Recommendation: all three; small and they share one function.
