# Plan: llm-oidc-release

Input: change.md. Complexity: trivial (one phase).

## Goal

The README section "Usage and cost" lists the values of `outcome`; CHANGELOG `0.1.1` says so; the version is bumped
to 0.1.1 (free on npm, which has only 0.1.0).

**Out of scope:** any code in `foundation/llm/src`.

## Phase 1: README, CHANGELOG and version

- One sentence on `outcome` in README; CHANGELOG `Unreleased` entry; `npm run release:version -- llm patch`.

Done when: `npm run lint` green and the CHANGELOG has `## 0.1.1`.

## Progress

- [x] Phase 1: README, CHANGELOG and version
