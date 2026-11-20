# Research: ci-usage-close-issue

- `tools/ci-usage/src/publish.ts`: `findIssue` lists `state: "open"` issues with the label and the report marker, so
  a closed report issue is invisible and the next run creates a new one.
- An issue is always created open (`POST /issues` takes no state); closing is `PATCH` with `state: "closed"` and
  `state_reason: "completed"`, which can ride the same `PATCH` that replaces the body.
- The reusable workflow `.github/workflows/ci-usage.yml` calls `softure-ci-usage publish` when `publish` is true; a
  new boolean input passes the flag through.
