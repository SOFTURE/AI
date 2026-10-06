# Plan review: release-0-1-3

Date: 2026-10-06 · Verdict: approved

- The anonymous lookups already clear `NODE_AUTH_TOKEN`, so moving the secret to `NPM_TOKEN` does not
  change what they see; `0.0.0-stage` counts as "on npm", which is what npm needs to bind a publisher.
- `setup-node` leaves a placeholder `NODE_AUTH_TOKEN` in the job environment when `registry-url` is set;
  npm 11.15 exchanges the OIDC token first, which is the documented trusted publishing setup.
- GitHub Packages and the GitHub Release are untouched: they use `GITHUB_TOKEN`.
