# Plan: backup-verify-live-release

## Approach

Change the example in place: resolve the image from the newest published release whose tag the registry holds, and
add two steps that turn the run's outcome into a `backup-verify` issue (open or comment on failure, close on success).
Give the Cloudflare template the same two steps. A repository test runs the steps' shell against fake `gh` and
`docker`.

## Decisions (auto)

- **Image name without a tag (`IMAGE: ghcr.io/acme/app`)**, the tag comes from the release walk; at most 20 releases
  are tried, and none with an image fails the run (with an error that names the image).
- **Login before the walk**, in its own step, so `docker manifest inspect` can read a private package.
- **The issue steps also go into the Cloudflare template**: the silent failure is the same there, and a template that
  stays silent would contradict the example. The image walk does not apply (it exports migrations from the checkout).
- **Assignee best-effort:** `gh issue create --assignee <owner>` and, when GitHub refuses it (an organisation), the
  same without the assignee.
- **The example pins the backup CLI it ships with** (0.1.3) and a test holds the pin equal to the package version, as
  for quality-review's workflow.
- Releases: backup 0.1.2 → 0.1.3 (example, README, CHANGELOG); deploy 0.7.6 → 0.7.7 (template), `deploy-cli-version`
  follows in the workflows that carry it.

## Phase 1: example, README, CHANGELOG, test (test-after)

- `modules/backup/examples/backup-verify.yml`: header text, `permissions: issues: write`, login step, "Find the live
  release's image" step writing `LIVE_IMAGE` to `$GITHUB_ENV`, copy step reads `$LIVE_IMAGE`, `if: failure()` and
  `if: success()` issue steps.
- `modules/backup/README.md` (step 7 and the verify line): what the workflow does on failure and why the release walk.
- `modules/backup/tests/verify-example.test.ts`: parses the example; runs the walk with a fake `gh` (three releases)
  and `docker` (only the second tag has a manifest) and expects the second; none with an image fails; runs the failure
  step with no open issue (label, create with assignee, retry without) and with one (comment); runs the success step
  (close). Pin equals `package.json` version.
- **Done when:** `npx vitest run modules/backup` green, `npm run lint` green.

## Phase 2: Cloudflare template (test-after)

- Template: `permissions: issues: write`, the same two issue steps, header text.
- `tools/deploy/tests/init-cloudflare.test.ts`: the generated workflow has both steps and `issues: write`.
- `tools/deploy/CHANGELOG.md`, `modules/backup/CHANGELOG.md` entries.
- **Done when:** `npx vitest run tools/deploy/tests/init-cloudflare.test.ts modules/backup` green; typecheck, lint.

## Progress

- [ ] Phase 1
- [ ] Phase 2
