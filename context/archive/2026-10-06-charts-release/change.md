---
change_id: charts-release
title: "Charts release"
status: archived
roadmap_item: CH-5
branch: claude/ch-5-release-bh8ocu
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`@softure-ai/charts` becomes a publishable package: the release pipeline accepts `charts@0.1.0` and ships it
together with `@softure-ai/ui` 0.1.6 (the chart tokens and `@softure-ai/ui/testing`), and the charts README tells
FIRE_TRACKER which of its chart files each export replaces. The publish itself is the owner's: it is irreversible,
and the first publish of a package that is not on npm yet needs his `NPM_TOKEN`.

A reviewer checks that `foundation/charts/package.json` is no longer private, that `release:pack` packs
`charts@0.1.0` and `ui@0.1.6` clean (no tests, the LICENSE in, dependency ranges npm can resolve once both are
out), the README's install and adoption sections, and the roadmap's owner steps.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item CH-5, taken 2026-10-06).

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-07-roadmap.md) (charts), item **CH-5**:

> - **Outcome:** `@softure-ai/charts` 0.1.0 (the owner provides `NPM_TOKEN` for its first publish and adds its
>   trusted publisher) and the next `@softure-ai/ui` with the testing helpers; README with an adoption guide for
>   FIRE_TRACKER's charts.
> - **Baseline:** package absent from npm. After: installable from npm and from GitHub Releases.

Measured 2026-10-06: npm has `@softure-ai/ui` 0.1.5 (master 0.1.6, unreleased) and no `@softure-ai/charts`
(E404). `release.yml` ("Publish to npm") publishes a package already on npm through its trusted publisher (OIDC)
alone, and hands `NPM_TOKEN` to npm only when the package is not on npm yet; without the secret the job stops with
an error before GitHub Packages and the GitHub Release (`scripts/release/README.md`, "First release of a
package"). The thread's question (does a new package really need the token?) is answered: yes, because npm binds
a trusted publisher only to a package that already exists. The 0.1.4 release did the same for `deploy` and
`testing`.

## Constraints

- No tag, release or npm publish by the agent: `auto-release` runs only on the owner's explicit word.
- `release.yml` and `auto-release.yml` stay as they are: the pipeline already handles a first publish.
- FIRE_TRACKER is read only; the adoption guide maps its files, it changes none.

## Research and framing

Skipped, both. The question this item carried (token or trusted publisher) is answered by reading two files,
`release.yml` and the release runbook, quoted above; the code work is one manifest field and a README section
over a package CH-1…CH-4 already documented. There is no competing framing: the roadmap fixed the outcome and the
owner's part.

## Outcome

Archived as `done_code`: on master, `@softure-ai/charts` 0.1.0 and `@softure-ai/ui` 0.1.6 are packed and checked;
they go live when the owner releases them (roadmap, "Owner decisions and checks"). Gap queued: CF-1 (`chart-pin`).
