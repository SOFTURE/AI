# Research: backup-verify-live-release

## Findings

- `modules/backup/examples/backup-verify.yml`: `IMAGE: ghcr.io/acme/app:latest`, one step logs in to ghcr.io and
  copies `/app/softure-migrations` out of `$IMAGE`. Permissions `contents: read`, `packages: read`. It pins
  `npx --yes @softure-ai/backup@0.1.0 verify`. No test reads the example today. It ships in the package (`files`).
- A deploy of `@softure-ai/deploy` tags the image with the release tag (`deploy-app.yml`, build job; with
  `prebuilt-image` through `docker buildx imagetools create`), so `<image>:<release tag>` exists only once that
  release's deploy has built or retagged it. Between publishing a release and that step, the release before it is
  the live one.
- `gh release list --exclude-drafts --exclude-pre-releases --json tagName,publishedAt` lists releases; `docker
  manifest inspect <ref>` answers whether the registry holds a tag without pulling it (needs the login first).
- GitHub mails a failed scheduled run only to the user who last changed the cron schedule. An issue reaches
  notifications and the issue count; `GITHUB_TOKEN` with `issues: write` can create a label, open, comment and close
  issues. An organisation (the repository owner of an org repository) cannot be an assignee, so the assignment has to
  be best-effort.
- The Cloudflare template (`tools/deploy/templates/cloudflare/.github/workflows/backup-verify.yml.tmpl`) has the same
  "GitHub mails the failure" header and no issue step; `tools/deploy/tests/init-cloudflare.test.ts` asserts its shape.
- Repository tests already run workflow shell with fake tools on `PATH` (`tests/repo/deploy-workflows.test.ts`), which
  is the pattern for testing the new steps.

## Risks

- A release whose deploy failed has no image; walking further back picks the release before it, which is what runs.
- `gh issue list --label <missing>` returns nothing, so the success step needs no label.
