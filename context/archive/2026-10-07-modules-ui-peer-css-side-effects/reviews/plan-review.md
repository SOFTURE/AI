# Plan review: modules-ui-peer-css-side-effects

Reviewed: `plan.md` against `change.md`, issue #167, the eight module manifests, `templates/package/`,
`scripts/release/release-rules.mjs` and `tests/repo/packages.test.ts`. Mode: autonomous (the thread decides).

Verdict: **ready after the fixes below** (applied to `plan.md` or binding for implementation).

## Findings

### F1 (Warning, applied): the ui guard must allow ui itself and charts' existing shape

**Evidence:** `foundation/ui` is the package the rule protects; `foundation/charts` already has ui as peer `^0.1.6`
and dev `^0.1.7`.

**Fix:** the guard skips `@softure-ai/ui`'s own manifest and accepts any peer range, requiring only that a peer has a
dev dependency and that `dependencies` never lists ui. Charts must pass unchanged.

### F2 (Warning, applied): a module reached only through another module still needs ui

**Evidence:** waitlist depends on auth, privacy and mailing; billing on auth. Each of those now peers ui.

**Analysis:** npm (7+) resolves the peers of nested dependencies from the app's root and installs a missing peer
automatically, so the chain gets the app's single ui copy; every one of these modules also peers ui itself. No extra
step needed; the blog README install line lists ui explicitly so the requirement is visible.

### F3 (Suggestion, applied): the guard should read `exports`, not `files`

**Evidence:** `files` lists folders and globs; `exports` names every published stylesheet (`./styles.css`), which
is what an app imports.

**Fix:** the CSS guard scans string export targets ending in `.css`.

### F4 (Suggestion, kept): the template has no ui dependency

**Evidence:** `templates/package/package.json` lists no dependencies. A package copied from it and given a ui
dependency is caught by the guard, so the template needs no change.

### F5 (Suggestion, applied): record that no release happens here

**Evidence:** project rule for releases: the last change touching a package publishes it. #154 changes every module's
Next adapter and #158 changes auth, feature-switches, waitlist and every package's CHANGELOG.

**Fix:** already in change.md § Constraints; the issue comment names the bumped versions as waiting for that release.

No findings against the measured peer floor (D1): the type-check against `ui@0.1.0` covers every import, and the
runtime surface the modules use (components and `DEFAULT_THEME`) is the same code.
