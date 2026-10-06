# Research: deploy-cut-release

## 1. What FIRE does (`FIRE_TRACKER/.github/workflows/auto-release.yml`)

One job, `workflow_dispatch` with one input (`opis`, the description), `permissions: {}` at the top and
`contents: write` + `actions: write` on the job, `concurrency: auto-release` without cancelling:

1. refuses any ref but `refs/heads/master`;
2. full checkout, `git fetch --tags`, then `base="v$(TZ=Europe/Warsaw date +%Y.%m.%d)"` and `-2`, `-3`, … until
   `git rev-parse refs/tags/$tag` fails;
3. `gh release create "$TAG" --target "$SHA" --notes "$OPIS" --generate-notes` (the description sits above GitHub's
   generated notes; the input reaches the shell through `env:`);
4. `gh workflow run release.yml --ref "$TAG"` and a job summary with the link to the started runs.

Generic: all of it. FIRE-specific: the branch name, the Warsaw time zone, the workflow file name and its extra input
(`skip_deploy`).

## 2. This repository's `auto-release.yml`

Packages, not apps (semver tags `<package>@<version>` from `package.json`). It confirms the same rule: a tag created
with `GITHUB_TOKEN` starts no workflow, so the last step starts `release.yml` explicitly. Semver tags therefore stay
with that workflow; DF-12 is the date-tag path for apps.

## 3. What a called workflow sees

In a reusable workflow `github.*` is the caller's context
([docs](https://docs.github.com/en/actions/sharing-automations/reusing-workflows#supported-keywords-for-jobs-that-call-a-reusable-workflow)):
`github.ref` and `github.sha` are the dispatched branch and commit, `github.repository` the app,
`github.event.repository.default_branch` the app's default branch (present in a `workflow_dispatch` payload), and
`github.token` carries the permissions the caller's job grants (it can only narrow them). So the called workflow can
refuse a non-default ref without an input, and the caller must grant `contents: write` (tag and release) and
`actions: write` (`gh workflow run`).

## 4. Listing the existing tags without a checkout

`gh api --paginate repos/<repo>/git/matching-refs/tags/<base>` lists every tag that starts with `<base>`
(`refs/tags/v2026.10.06`, `refs/tags/v2026.10.06-2`, …). Comparing candidates against that list for equality is
enough; no checkout (and no app `.npmrc` or hooks) is needed. A tag created between listing and creating makes
`gh release create` fail on "already exists"; the `concurrency` group keeps two dispatches in one repository from
racing.

## 5. The deploy caller it starts

`tools/deploy/examples/deploy.yml` (and `init`'s template) has `workflow_dispatch` with one required input, `tag`.
`gh workflow run deploy.yml --ref <tag> -f tag=<tag>` starts it on the tag; DF-11's guard (tag commit on the
default branch) holds because the tag targets the dispatched default-branch commit.

## Decisions

- **Tag pattern:** dates only; `tag-prefix` (default `v`) and `timezone` (default `UTC`, FIRE passes
  `Europe/Warsaw`) are inputs. Semver stays out: apps here release by date and packages have their own workflow.
- **Deploy workflow:** input `deploy-workflow` (default `deploy.yml`, the file `init` writes); empty cuts the release
  only.
- **Target commit:** `github.sha` of the dispatch, not "master now", so a merge landing during the run does not slip in.
