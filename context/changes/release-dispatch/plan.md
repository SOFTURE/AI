# Plan: release-dispatch

Input: change.md, research.md. Complexity: small (one phase).

## Goal

- `scripts/release/plan-tags.mjs` exports `planReleaseTags(packages, request)`: for `all` or a list of
  short names it returns the tags `<short>@<version>` of the public packages, in dependency order, or a
  failure naming the unknown or private name. Its CLI prints one tag per line.
- `.github/workflows/auto-release.yml`: `workflow_dispatch` on `master` with input `packages`
  (default `all`); plans the tags, creates each missing one on the current `master` commit with
  `GITHUB_TOKEN`, then runs `release.yml` on it; the step summary lists created, skipped and started.
- `scripts/release/README.md` describes the dispatch as the way to release, with the rule that the agent
  runs it only on the owner's word; `release.yml`'s header names the dispatch path.

**Out of scope:** bumping versions (still `release:version` or a PR; LT-2); npm approval (stays with the
owner); changing `release.yml` jobs.

## Approach

**Chosen:** the FIRE_TRACKER pattern, per package: a planner script (testable) plus a thin workflow.
Rejected: a `publish: true` input on `release.yml` itself - it would publish without a tag and break the
"version = tag" contract the pack step checks; pushing tags with a PAT - a long-lived secret for what
`GITHUB_TOKEN` + dispatch already does.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Version source | `package.json` on `master` | the tag must equal it (pack check) | research |
| Existing tag | skipped, reported | re-runs go through "Run workflow" on the tag (runbook) | research |
| Order | dependency order | matches the approval order in the runbook | research |
| Annotated tags | `git tag -a`, author github-actions[bot] | same as `release:version` | version.mjs |

## Phase 1: Planner, workflow and runbook

**Discipline:** TDD for the planner; test-after for the workflow (checked by its first run).
**Files:** `scripts/release/plan-tags.mjs`, `tests/repo/release-tags.test.ts`,
`.github/workflows/auto-release.yml`, `.github/workflows/release.yml`, `scripts/release/README.md`.

1. Tests first: `all` gives the 16 public packages in dependency order (core first, waitlist after
   privacy); a list keeps dependency order; unknown name, private name and an empty list fail with a
   reason naming the input; duplicates collapse.
2. `plan-tags.mjs`: `planReleaseTags(packages, request) → { ok: true, tags: string[] } | { ok: false, reason: string }`,
   built on `readReleasePackages`, `orderWorkspaces` and `getReleaseTag`; CLI `node scripts/release/plan-tags.mjs <all|names…>`.
3. `auto-release.yml` as above: refuses any ref but `refs/heads/master` before planning; `permissions: {}` at the top, `contents: write` and `actions: write` on
   the job; input through `env`.
4. Runbook section "Release from Actions" and header line in `release.yml`.

**Done when:** the planner tests pass; the gates pass; `node scripts/release/plan-tags.mjs all` prints
16 tags; the workflow's first run (after merge) creates the tags and starts 16 release runs.

## Risks and rollback

- The workflow fails on its first run: nothing is published before `release.yml`'s gates; fix forward.
  Rollback: delete the file.

## Decisions (auto)

- Default input `all` → the common case is the batch; one name releases one package.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Planner, workflow and runbook

#### Automated
- [ ] 1.1 Planner tests written first and passing
- [ ] 1.2 `auto-release.yml` runs on master only, plans, tags and dispatches; inputs only through env
- [ ] 1.3 Runbook and `release.yml` header describe the dispatch
- [ ] 1.4 Gates green (typecheck, lint, test) and build

#### Manual
- [ ] 1.5 First dispatch on `master` creates the 0.1.0 tags and starts their release runs
