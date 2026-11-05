---
change_id: marketing-kit-mix-retry-1095
title: "marketing-kit: the mix stage's retries model the limiter, so keep speech no longer ping-pongs at the window's edge (issue #1095)"
status: archived
roadmap_item: null
issue: 1095
branch: claude/project-thread-ovtic3
created: 2026-11-05
updated: 2026-11-05
archived_at: 2026-11-05
---

## Intent

Close [issue #1095](https://github.com/SOFTURE/AI/issues/1095): with `mixLoudness.keep: "speech"` the final pass's mix
stage fails films with loud, percussive music after `MIX_ATTEMPTS` encodes. A retry aims at the window's edge, the
limiter (whose ceiling the same retry lowers) takes back part of the gain, and the mix lands past the edge again. A
retry should land the mix inside the window and under the true peak limit within `MIX_ATTEMPTS` encodes.

## Context

Labels: `pkg: marketing-kit`. Introduced by #1079 (mix stage retries) and #1085 (`keep: "speech"`), both in 0.12.0.
A parallel thread bumps dependencies (lockfile, possibly satori/fflate in marketing-kit); this change touches no
manifest and no lockfile. No version bump: the fix joins the next combined marketing-kit release (coordinator).

## Constraints

- The first encode stays as it is (same gain and ceiling), so a mix that meets the target in one encode, as in the
  adopting app's render check, is unchanged.
- No manifest or lockfile change.

## Notes

- Framing: skipped. The issue measures the failure and names the fix's direction.

## Done

A mix stage retry models the limiter's loudness cost (fitted from the encodes so far) and solves the gain for the new
ceiling; with `keep: "speech"` it aims 0.3 LU inside the window. The issue's loud percussive fixtures finish within
4 encodes. Ships in the next combined marketing-kit release.
