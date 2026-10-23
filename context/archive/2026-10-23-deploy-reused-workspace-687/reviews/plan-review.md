---
change_id: deploy-reused-workspace-687
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the workflows on master.

- Scope: covers every job of the reusable workflows that checks out, not only the two the issue names, since the
  research shows any sparse/full pair breaks. The app's own jobs stay out of scope and go to the README.
- Order: the step must run before anything writes into the workspace, so right after "Check the runner", and before
  `blog-links.yml`'s `defaults.run.working-directory` exists (hence `working-directory: ${{ runner.temp }}`).
- Safety: `${GITHUB_WORKSPACE:?}` guards an unset variable; `-mindepth 1` keeps the folder itself. `find -exec ... +`
  returns non-zero when `rm` fails, so the error path is reachable. BSD and GNU `find` both take these flags.
- The test must fail on master (no such step) before the workflows change.

Verdict: approved, no changes.
