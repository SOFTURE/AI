---
change_id: deploy-integration-ref-delete-684
status: done
---

# Research: integration ref deletion (issue #684)

## Findings

- `.github/workflows/deploy-integration.yml`, step "Delete the integration ref": `gh api --method DELETE
  "repos/$GITHUB_REPOSITORY/git/${GITHUB_REF#refs/}"`. For `refs/heads/integration/x` that is
  `repos/o/r/git/heads/integration/x`.
- GitHub REST: "Delete a reference" is `DELETE /repos/{owner}/{repo}/git/refs/{ref}`, with `ref` fully qualified
  without the `refs/` prefix (`heads/<branch>`). A missing ref answers 422 "Reference does not exist", which the step
  already accepts. An unknown path answers 404 "Not Found", which the step rejects: the run ends red.
- `tests/repo/deploy-workflows.test.ts`, "deletes only an integration ref, and accepts one already gone": the `gh`
  stub accepts any arguments and logs them to a file nobody reads, so the wrong path passed.
- The repository has no end-to-end run of `deploy-integration.yml` (`e2e-deploy.yml` covers deploy-app,
  release-checks and report). Running it end to end needs pushing `integration/*` branches to this repository on
  every pull request.

## Options

1. Fix the path and make the stub behave like the API: succeed only for `repos/<repo>/git/refs/heads/...`, answer
   "Not Found (HTTP 404)" for any other path, and assert the exact call. Cheap, runs on every `npm test`, fails on
   the old code.
2. Add a job to `e2e-deploy.yml` that pushes an `integration/e2e-<run>` branch and calls the workflow, then checks the
   ref is gone. Real API, but writes refs and notes into this repository on every e2e run and needs `contents: write`.

Recommendation: option 1.
