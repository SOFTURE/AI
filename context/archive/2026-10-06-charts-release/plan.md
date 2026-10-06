# Plan: charts-release

Input: change.md. Complexity: small (one phase: make charts publishable and document its adoption; the publish is
the owner's).

## Goal

- `foundation/charts/package.json` drops `"private": true`, so `auto-release` plans `charts@0.1.0` and
  `release:pack --tag charts@0.1.0` packs it.
- `foundation/charts/README.md`: the install section says how the package ships (npm, GitHub Packages, GitHub
  Release, with `@softure-ai/ui` 0.1.6 next to it) instead of "private until CH-5"; a new **Adopting in
  FIRE_TRACKER** section maps each FIRE chart file to the export that replaces it, and says what stays in FIRE.
- Roadmap: CH-5 goes `in_progress`, then `done_code` waiting on the owner's release; **Owner decisions and checks**
  gets the exact steps (token, `auto-release` with `ui charts`, trusted publisher, delete the token).
- A gap found while mapping FIRE (its `ChartPin`, generic in CH-2's research, not shipped) opens the catch-all
  `charts-followups` with CF-1, per the roadmap header.

**Out of scope:** the publish, a tag, a version bump (charts is at 0.1.0 and never published; ui 0.1.6 is
unreleased and already carries CH-2…CH-4), any change to `release.yml` or `auto-release.yml`.

## Key decisions

- **Release both together:** `auto-release` with `ui charts`. charts depends on `@softure-ai/ui` `^0.1.6`; npm does
  not check dependencies at publish time, and both runs start from the same dispatch, so the order inside it does
  not matter. `all` would work too (released versions are skipped), but names the intent less clearly.
- **Token is required:** the workflow uses `NPM_TOKEN` only when the package is not on npm (change.md, Context);
  nothing to change in the pipeline.
- **No new test:** the release rules are covered by `tests/repo/release-*.test.ts`; the proof for this change is a
  real pack of both tags plus an install of the two tarballs into an empty project outside the repo.

## Phase 1: Publishable charts (test-after)

- `foundation/charts/package.json`: remove `private`.
- `foundation/charts/README.md`: Installation, Adopting in FIRE_TRACKER.
- `tests/repo/release-tags.test.ts`: `all` plans 19 public packages, not 18 (added in implementation, impl review #4).
- Roadmap row and block, owner steps; `context/backlog/roadmap-charts/` (entry taken, folder emptied);
  CF-1 roadmap, backlog entry and README row; `roadmaps/README.md` row.

Done when: `npm run release:pack -- --tag charts@0.1.0` and `--tag ui@0.1.6` print `ok`; the tarballs install into
an empty project with React 19 and `LineChart` renders on the server and `checkSeriesPalette()` returns `[]`;
`node scripts/release/plan-tags.mjs "ui charts"` prints both tags; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Publishable charts

#### Automated
- [ ] 1.1 Both tags pack clean and the tarballs install and render outside the repo
- [ ] 1.2 auto-release plans both tags
- [ ] 1.3 Gates green (typecheck, lint, test, build)

#### Owner
- [ ] 1.4 Owner releases ui 0.1.6 and charts 0.1.0 (NPM_TOKEN, trusted publisher)
