# Implementation review: release-version-inline-manifest

Date: 2026-10-06 · Scope: phase 1 (`0c8b384`) · Verdict: approved

Checked against plan.md, the diff of `scripts/release/version.mjs`, `scripts/release/README.md` and
`tests/repo/release-version.test.ts`, and the AGENTS.md conventions.

## Plan conformance

- `setInlineManifestVersion` is exported and replaces only the manifest's top-level `version` (tests: nested
  version, a `version:` in a comment and in a string before the manifest, missing and duplicate manifests).
- The inline check runs before `npm version`; a refusal says "nothing was changed" and leaves the tree as it was,
  like the range check next to it. `src/index.ts` is written after `module.json` and staged in the release commit.
- The sweep reads every released module's real `src/index.ts` (12 today) and asserts exactly one changed line.
- Seen red: before the function existed, 17 of the new tests failed (missing export).
- Scratch bump (criterion 1.3): `release:version -- ops patch` in a detached worktree committed exactly
  `module.json`, `package.json`, `src/index.ts` and `package-lock.json` (`0.1.5` → `0.1.6`); with that diff applied
  the ops module tests passed 6/6, and with the same diff minus `src/index.ts` (the old behaviour) both version
  tests failed. The tag and the worktree were deleted; nothing was pushed.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | The code scanner skips strings, template literals and comments but not regular-expression literals or `${}` nesting inside templates; a manifest file with a regex containing a quote could mislead it. | Accepted as is: no module entry point has either today, and the sweep test over the real files fails in `npm test` (not at release time) the day one does. |
| 2 | Suggestion | A quoted key (`"version": "0.1.0"`) inside the manifest is a string to the scanner, so it would be refused rather than updated. | Accepted: refusal is the safe outcome and the message names the file; the formatter writes unquoted keys. |

No Critical or Warning findings. No public API, migration or version change; English only (language gate green).

## Gates

typecheck and lint green in the pre-commit hook of `0c8b384`; `npm test` 3952 passed, 70 skipped, 1 failed: the link check on the moved backlog entry, fixed by this archive; `npm run build` green.
