# Plan: deploy-integration-packages-read

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Goal

`deploy-integration.yml`'s `test` job holds `contents: read` and `packages: read`, so a `registry-token` set from
the caller's `GITHUB_TOKEN` pulls a private GHCR image. The example caller and the README tell an app to grant
`packages: read`; a repository guard pins both.

**Out of scope:** the other deploy workflows, a release, the adopting app's own callers.

## Key decisions

- **`packages: read` on the test job, not a separate pull job.** A pull job would need the same grant from the caller
  and an artifact hand-off of the image; the token already reaches only the pull step.
- **The example caller grants `packages: read` too.** Without it every run of a caller that copied the example is
  refused at start once the test job asks for the scope. The changelog says so as a required caller change.

## Phase 1: Grant and guard

- `deploy-integration.yml`: `jobs.test.permissions` gains `packages: read`; header comment says why.
- `tools/deploy/examples/integration.yml`: `permissions` gains `packages: read`, comment updated.
- `tools/deploy/README.md`: the test job line names `packages: read` and that the caller must grant it.
- `tools/deploy/CHANGELOG.md`: `## Unreleased` entry.
- `tests/repo/deploy-workflows.test.ts`: the test job's permissions equal `{ contents: read, packages: read }`; the
  example caller's equal `{ contents: write, packages: read }`. Both assertions fail before the edit.

Done when: the two guard tests fail on the old workflow and pass on the new one; `npm run typecheck`, `npm run lint`
and `npm test` are green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Grant and guard

#### Automated
- [ ] 1.1 Guard tests for the test job and the example caller fail first, then pass
- [ ] 1.2 Workflow, example caller, README and changelog updated; gates green
