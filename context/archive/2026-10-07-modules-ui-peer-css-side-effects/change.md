---
change_id: modules-ui-peer-css-side-effects
title: "blog + modules: CSS side effects and @softure-ai/ui as a peer (issue #167)"
status: archived
roadmap_item: null
issue: 167
branch: claude/project-thread-sm2mhv
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close both points of issue [#167](https://github.com/SOFTURE/AI/issues/167), the module-side follow-up of #157:

1. `@softure-ai/blog` ships `styles.css` but declares `"sideEffects": false`, so a bundler that trusts the flag may
   drop `import "@softure-ai/blog/styles.css"`. It becomes `"sideEffects": ["*.css"]`, as in ui and charts.
2. Eight modules (auth, billing, blog, feature-switches, mailing, mcp-access, privacy, waitlist) list
   `@softure-ai/ui` under `dependencies`. When an app's own ui range and a module's range do not overlap, npm installs
   a second copy: two token sets and two theme / locale contexts. ui becomes a peer dependency of each module (and a
   dev dependency for the workspace), as in charts 0.1.2.

A reviewer checks the manifests, the new guards in `tests/repo/packages.test.ts`, the blog README install line and
the patch bumps of the eight modules.

## Context

No roadmap: issues are the tracker. No other module ships CSS (`modules/*/styles.css` exists only for blog).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- No behaviour change in any module: only manifests, docs and a repository test.
- The peer range must not shut out an app that works today: the floor is the oldest ui release the modules still
  type-check against (measured, see `plan.md` § Findings).
- Every module gets a patch bump (the issue asks for a patch release of each). Publishing waits for the last open
  change in each package: #154 (every module's Next adapter takes its database handle) and #158 (auth,
  feature-switches, waitlist, the CHANGELOG of every package) still touch all eight, so this change does not release.

## Process notes

- Research: skipped as a separate artefact. The issue names every file; the reading needed (eight manifests, which ui
  exports each module imports, a type-check of the modules against every older ui release) is short and recorded in
  `plan.md` § Findings.
- Framing: skipped. Both points are the same packaging defect #157 already fixed in ui and charts, with the same fix;
  there is no competing explanation or cheaper path.
