---
change_id: ops-build-info-878
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (90e8bad).

- Scope covers the issue's ops and deploy proposal: build info (release at request time, commit and build time
  inlined, start time), the route, the `next.config` helper, the changelog provider; the smoke CLI, the action step
  with its summary line and `deploy-app.yml` input; the changelog from the roadmap readers. MCP is excluded as briefed.
- Opt-in: every new input defaults to empty, so an existing caller deploys as before. The new build argument is
  harmless for a Dockerfile that does not declare it (BuildKit warns, never fails).
- Risk: whether Next inlines `env` into package code. The e2e spec measures it; the route also takes explicit values.
- Risk: clock skew between runner and server; covered by the tolerance.
- Proof: unit tests for both packages, repository tests for the wiring, the example app's e2e for the route, and
  e2e-deploy for the whole smoke step.

Verdict: approved, no changes.
