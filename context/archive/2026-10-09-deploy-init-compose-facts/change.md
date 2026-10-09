---
change_id: deploy-init-compose-facts
title: "deploy: init takes the Postgres major and the report role from the app's compose file, and the callers stop pinning a tag that does not exist (issue #297)"
status: archived
roadmap_item: null
issue: 297
branch: claude/project-thread-xu1wys
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

An app that already has its own `docker/prod/docker-compose.yml` (an adopting app runs `postgres:17-alpine` and a
`DATABASE_URL` as its own role) gets a `deploy.sh` from `softure-deploy init` whose tools image carries the
`pg_dump` of the compose file's Postgres major and whose `report` command reads as the role of the app's
`DATABASE_URL`, instead of a fixed Postgres 16 and `softure_app`. The caller workflows `init` writes, the examples and
the README stop pointing at `deploy-workflows-v1`, a tag that was never created: they pin a commit SHA (the commit of the
`deploy@<version>` release tag), which `init` takes as `--workflows-ref`.

A reviewer checks the new cases in `tools/deploy/src/init/compose-facts.test.ts` and
`tools/deploy/tests/init-cli.test.ts`, the README's `init` and workflow sections and the CHANGELOG entry.

## Context

Issue [#297](https://github.com/SOFTURE/AI/issues/297), in short (found while moving an adopting app onto deploy 0.1.6):

1. `TEMPLATE_VERSIONS.postgres` is `"16"`, so `deploy.sh` gets `TOOLS_IMAGE=softure-deploy-tools:<v>-pg16` and a
   header claiming the helper follows the compose file's Postgres major. Against a PG17 server a pg_dump 16 refuses
   (`server version mismatch`) unless `database.access` is `compose-exec`.
2. `REPORT_ROLE=softure_app` is fixed; the adopting app's `DATABASE_URL` role is `<app>_app`, so `report` fails with
   `role "softure_app" does not exist`.
3. The README (and the templates and examples) say callers pin `deploy-workflows-v1`; the tag does not exist, so the app
   pins the commit of `deploy@0.1.6` (`8d8b8e5a7c246b9afe4e92dc055105f042af37ab`). "Either create the tag or document
   the SHA pin."

Known state: when `init` writes the compose file itself, both values are consistent by construction (the template
uses `postgres:{{postgresVersion}}` and `softure_app`). The gap is an app whose compose file `init` keeps.
`deploy.sh` relies on the service names `app` and `postgres`. Package release tags `deploy@<version>` exist on
SOFTURE/AI and point at the release commit, whose workflows default `deploy-cli-version` to that version.

## Constraints

- Only `tools/deploy` (source, templates, tests, README, examples, CHANGELOG), `tests/repo/deploy-workflows.test.ts`
  and this change's `context/` folder.
- No tag is created or moved (the owner's call, out of this change); no release, no version bump: the entry goes under
  `## Unreleased` in `tools/deploy/CHANGELOG.md`.
- #296 changes the same package and README in parallel: keep edits local, bring in master after each merge.
- Backward compatible: `AppFacts` is exported, so the new field is optional; an app without a compose file gets the
  same files as before, apart from the workflow ref.
- English only.

## Notes

- Research: skipped as a separate artefact; the issue names the values and files, and `plan.md` § Findings holds the reading.
- Framing: skipped; the issue states the failures, the trigger and the expected fixes.
- Placement: unlinked (`roadmap_item: null`, `issue: 297`), per the project rule that each GitHub issue is one change.
- Owner: creating a moving `deploy-workflows-v1` tag later stays possible; the docs then name both ways.
- Archived 2026-10-09: `init` takes the Postgres major and the report role from the app's compose file;
  `--workflows-ref` pins the callers; README, examples and templates no longer name `deploy-workflows-v1`.

## Process notes

- The tag itself: per the coordinator's brief no tag is created; the docs name the SHA pin.
