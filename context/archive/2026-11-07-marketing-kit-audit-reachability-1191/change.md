---
change_id: marketing-kit-audit-reachability-1191
title: "marketing-kit: keep the pinned undici and fflate findings out of reach, and say why (issue #1191)"
status: archived
roadmap_item: null
issue: 1191
branch: claude/project-thread-8oieqw
created: 2026-11-07
updated: 2026-11-07
archived_at: 2026-11-07
---

## Intent

Close [#1191](https://github.com/SOFTURE/AI/issues/1191): `npm audit --omit=dev` in an app on marketing-kit 0.21.0
reports `undici` 7.25.0 (high, pinned by `hyperframes` 0.9.6 and still by 0.9.19) and `fflate` 0.7.3 (moderate,
pinned by `satori` 0.63.2). The kit cannot lift either pin (npm `overrides` in a dependency do not reach the app),
so it takes the issue's second option: it documents exactly why neither finding is reachable from the kit, and it
enforces the undici half in code, so the statement stays true.

## Context

Labels: `pkg: marketing-kit`. Upstream fixes are open and unreleased (hyperframes #6695, satori #952). The thread
releases marketing-kit only after the coordinator's go (releases are batched per package).

## Constraints

- No change to a rendered film: every composition the kit builds today stays byte for byte the same.
- No test talks to an external service.

## Notes

- Framing: skipped. The issue names both findings and both acceptable outcomes.

## Decisions (auto)

- No fork or vendored copy of hyperframes or satori: a fork is a new package (the owner's word), and bundling
  hyperframes would ship one platform's esbuild binary.
- hyperframes reaches undici only through its download helper (remote media, images and stylesheets named in the
  composition). The kit already downloads URL clips itself with the global `fetch`, so the composition is local by
  construction; a guard makes both composers refuse a remote reference instead of relying on that.

## Done

`composeFilm` and `composeFootage` refuse a remote asset (`assertLocalReferences`), so hyperframes never downloads
anything and its pinned `undici` stays unreachable; the README's "npm audit" section says why the `undici` and
`fflate` findings do not apply and how an app lifts them (#1191). Next marketing-kit release.
