---
change_id: marketing-kit-hdr-lut-1037
title: "marketing-kit: footage normalize tone-maps HDR through a 3D LUT (issue #1037)"
status: archived
roadmap_item: null
issue: 1037
branch: claude/project-thread-b6axnq
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1037](https://github.com/SOFTURE/AI/issues/1037). `prepareFootage` tone-maps an HDR (HLG, PQ, Dolby
Vision) phone clip in float (`zscale` to linear light, `tonemap=hable`, `zscale` back), which costs about 1.4 s per
footage second at 1080x1920 on one CPU. After this change:

1. the normalize applies the same Hable mapping through a 3D LUT (`lut3d`, tetrahedral, 16-bit), generated once per
   transfer by running the kit's own float chain over an identity lattice, so the look follows the curve;
2. the tone map costs well under a second per footage second at 1080x1920 on one CPU, measured;
3. the README states the cost per footage second of an HDR clip and that 4K HEVC HDR decoding needs more CPU.

## Context

Labels: `bug`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/{normalize,pipeline}.ts`, a new
`src/footage/tonemap-lut.ts`, their tests, `src/index.ts`, README, CHANGELOG.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed.
- `buildNormalizeArgs` stays pure; callers without a LUT keep the float chain.

## Notes

- Framing: skipped. The issue measures the problem and names the directions.
