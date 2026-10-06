# Research: release-version-inline-manifest

Date: 2026-10-06 · Input: change.md

## Current state

- `scripts/release/version.mjs` runs `npm version <v> -w <dir> --no-git-tag-version` (package.json and the root
  lockfile), then `setModuleVersion` sets the top-level `"version"` of `module.json` with a depth-aware scan, and
  commits and tags those files.
- Twelve modules (`modules/*`) declare their manifest inline: `export const <name> = defineModule({ manifest: { id:
  MODULE_ID, version: "0.1.5", ... } })` in `src/index.ts` (auth is at 0.1.6). Every one has `version` as the
  second key of `manifest`; no manifest holds another `version:` key, but privacy's doc comment has
  `version: "2026-10-01"` outside the manifest, so a plain text replace of `version:` would hit the wrong place.
- Each module's `tests/module.test.ts` checks `module.json` equals `toModuleJson(module)` and that
  `manifest.version` equals `package.json`'s. A bump through `release:version` therefore turns both tests red,
  and the release workflow's gates (validate job) refuse the tag.
- The 0.1.5 bump (`c44ef17`, release-0-1-5) edited the 36 files by hand, which is why nothing failed so far.
- `templates/package` has `module.json` but no inline manifest; it is private, so `release:version` refuses it
  before any change.
- Foundation packages (`core`, `db`, `ui`, `testing`) and `tools/*` have no `module.json`.

## Options

1. **The script rewrites the inline version** (a depth-aware scan inside the `manifest: {` object of
   `src/index.ts`, like `setModuleVersion` does for JSON). Twelve entry points unchanged; one more file in the
   release commit; refuses before any change when it cannot find exactly one place.
2. **The manifest imports `module.json`** (`import moduleJson from "../module.json" with { type: "json" }`).
   Removes the copy, but changes the shape of twelve public entry points: the JSON must ship next to `dist/`
   (`files`, `exports`), every consumer bundler (Next.js, Vitest, tsc `resolveJsonModule`) must accept import
   attributes, and a JSON import loses the literal types `defineModule` infers from the inline object. Larger blast radius than the gap it closes.

Decision: option 1. The release test (`module.json equal to its manifest`) keeps guarding both copies, so a hand
edit that misses one still fails, and the script stops a bump it cannot complete before touching anything.

## Risks

- A future module puts `version` somewhere the scan misses: the script refuses with the file named, and the repo
  test over every released module fails first.
