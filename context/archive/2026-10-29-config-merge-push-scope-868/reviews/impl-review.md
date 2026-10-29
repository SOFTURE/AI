---
change_id: config-merge-push-scope-868
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and the acceptance of #868.

- Merge-only push: `getMergePushScope` excludes main-branch commits from the range, accepts context-only commits and
  merges whose other parents are ancestors of `<remote>/<main>`, and returns the branch's files against the merge
  base. Tested with real repositories, including a conflict resolution and context commits around the merge.
- Full suite: new branch code, a merge of another branch or of local main commits not on the remote, each built-in
  category (migration, manifest, nested manifest, lockfile, vitest config, setup file, tsconfig, ESLint config, env
  file), the app's `fullSuiteOn` glob, no merge, nothing to push, no upstream, no main branch, a git error. All tested.
- Preset: `lefthook run pre-push` on the preset with stubbed commands proves the four cases (code push, merge push,
  context-only push, failing bin) run the right jobs; one passing `skip` entry skips a job in lefthook 2.1.16.
- `softure-context-only-push` untouched; its tests pass unchanged.
- Deviation from plan: the config of another test runner is not in the built-in list (the language gate reads one
  runner's name as a Polish word), and the related run is `vitest`; an app on another runner lists its config under
  `fullSuiteOn`.
- Docs: README section with the rules, the override for another test command and the opt-out (the opt-out is pinned
  by a `lefthook dump` test); CHANGELOG `## Unreleased` with the migration. No version bump.

Gates: typecheck, ESLint and the language gate green on every commit; `tools/config` tests 113 passed; build of the
package produces the bin.

Verdict: approved.
