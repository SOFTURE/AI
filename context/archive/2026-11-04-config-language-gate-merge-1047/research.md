# Research: language gate on a merge commit (issue #1047)

## Current state

- `tools/config/src/cli/check-language-command.ts`: `runCheckLanguage(args, environment)` reads every named file from
  the working tree and runs `checkFiles` → `findPolishText`; the environment injects `cwd` and `listTrackedFiles`.
- The pre-commit job of the preset is `npx softure-check-language {staged_files}`; this repository runs the same entry
  through `tsx`. During `git merge` + conflict resolution + `git commit`, lefthook's `{staged_files}` lists every file
  the merge stages, including those taken unchanged from the merged branch.
- `context-only-push-command.ts` exports `runGitCommand` / `RunGit` (stderr ignored), reused by
  `merge-push-scope-command.ts`. Tests there build real git repositories in temp folders.

## Git facts

- A merge in progress has `MERGE_HEAD` (`git rev-parse --verify --quiet MERGE_HEAD` exits 0). An octopus merge lists
  several heads in `.git/MERGE_HEAD`; `rev-parse MERGE_HEAD` gives the first. Octopus merges never stop for a commit
  with conflicts, so the first head is enough in practice; reading every line of the file is safer and cheap
  (`git rev-parse --git-path MERGE_HEAD`).
- `git show <rev>:./<path>` reads a file relative to `cwd`; it fails for a path the revision does not have.
- With `git merge --no-commit` and a clean merge, pre-commit also runs on `git commit`: same situation.

## Options

1. Skip files identical to the merged parent's version. Misses the conflict-resolved file whose other lines came from
   main (the issue's reproduction resolves an unrelated conflict, but a Polish line from main can sit in the conflicted
   file too).
2. Line filter: drop a hit whose line text appears in any parent's version of the file (HEAD and every merge head).
   That is the "combined diff" rule of the issue: a line is the merge's own only when it differs from every parent.
   Covers both cases; a Polish line typed during resolution is new to every parent, so it still fails.

Recommendation: option 2.
