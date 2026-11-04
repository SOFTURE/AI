---
change_id: marketing-kit-draft-threads-1024
title: "marketing-kit: ffmpeg thread count for the footage draft (issue #1024)"
status: archived
roadmap_item: null
issue: 1024
branch: claude/project-thread-hfcs2p
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1024](https://github.com/SOFTURE/AI/issues/1024). `renderFootageDraft` opens one input per EDL segment,
and every input's decoder, the filter graph and x264 size their threads by the host's cores, not a container's CPU
quota: under a 1-CPU quota the extra threads buy no speed but nearly double the peak memory. After this change:

1. `RenderFootageDraftOptions.threads` and `FootageDraftArgsInput.threads` set `-threads N` on every segment input
   (the decoders), `-filter_complex_threads N` and `-threads N` for the encoder;
2. the default is unchanged (ffmpeg's own choice);
3. an invalid value throws as `normalize.threads` does (a positive whole number).

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/{draft,normalize}.ts`, the draft
test, README, CHANGELOG. The draft and the normalize option shipped in 0.6.0 (#1018, #1015).

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue measures the problem and names the option to add.
