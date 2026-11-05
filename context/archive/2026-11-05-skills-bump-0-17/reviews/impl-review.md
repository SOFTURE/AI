# Implementation review: skills-bump-0-17

Verdict: approved.

- `package.json` changes only the skills range; the lockfile resolves 0.17.0.
- The managed block in `AGENTS.md` is the installer's output, unchanged by hand; the project section sits above the
  block marker and now names the package value it relies on.
- `context/workflow.json` stays valid JSON; `wt-merge-check.py` 0.17.0 accepts `on-conflict`.
- Gates: typecheck green (pre-commit), language gate green, `tests/repo` 595 passed, 69 skipped; the one failing file
  (`deploy-workflows.test.ts`, missing `ssh-keygen`) fails identically on the base commit and runs in CI.
