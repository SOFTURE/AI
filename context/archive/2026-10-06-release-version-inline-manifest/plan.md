# Plan: release-version-inline-manifest

Input: change.md, research.md. Complexity: small (one phase: one script function, its tests, the runbook line).

## Goal

- `scripts/release/version.mjs` exports `setInlineManifestVersion(text, version)`: it sets the `version` key of the
  `manifest: { ... }` object in a module's `src/index.ts` and nothing else, or returns `{ ok: false, reason }`
  when the file has no single `manifest: {` object with one top-level `version: "..."`.
- `release:version` checks the inline manifest **before** `npm version` runs (a refusal changes nothing), writes it
  after `module.json`, and adds `src/index.ts` to the release commit.
- `tests/repo/release-version.test.ts` covers the function (replace, nested version left alone, comment outside the
  manifest left alone, missing and duplicate manifests refused) and runs it over every released module's real
  `src/index.ts`: exactly one line changes, and it is the manifest's version line.
- `scripts/release/README.md` says the command also sets the inline manifest.

**Out of scope:** importing `module.json` into the manifest (research, option 2); any version bump or release.

## Approach

Option 1 of research. The scan reuses the idea of `getDepthAt` (braces outside strings) with TypeScript in mind:
skip `"..."`, `'...'` and template strings and `//` and `/* */` comments while counting `{`/`[` depth from the
`manifest: {` brace. The key matches `version` followed by `:` and a double-quoted string at depth 1. The release
commit stages `src/index.ts` only when `module.json` exists (every module has both).

## Key decisions

- **Refuse before changing anything.** The inline check runs next to the dependents' range check, before
  `npm version`, so a module the scan cannot read leaves a clean tree, as the other refusals do.
- **One `manifest: {` per file.** Two would make the target ambiguous; none is refused when `module.json` exists
  (a module without an inline manifest would leave `module.json` and the code apart anyway).

## Phase 1: The script sets the inline manifest version (TDD)

- `tests/repo/release-version.test.ts`: cases for `setInlineManifestVersion` and the sweep over released modules
  (red first: the export does not exist).
- `scripts/release/version.mjs`: the function, the pre-check and the write, the commit's file list.
- `scripts/release/README.md`: one sentence in "Release a version".

Done when: the new tests pass and were seen red; a bump of `ops` in a scratch worktree (`release:version -- ops
patch`, never pushed, tag deleted) leaves `ops`'s module tests green and its commit lists four files; gates green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The script sets the inline manifest version

#### Automated
- [x] 1.1 `setInlineManifestVersion` tests seen red, then green — 0c8b384
- [x] 1.2 Every released module's `src/index.ts` changes in exactly its manifest version line — 0c8b384
- [x] 1.3 A scratch bump of `ops` keeps its module tests green and commits package.json, lockfile, module.json and src/index.ts — 0c8b384
- [x] 1.4 Gates green (typecheck, lint, test, build) — 0c8b384
