# Plan: marketing-kit-draft-in-pieces

## Steps

1. Golden fixture of today's `buildFootageDraftArgs` over a cut with every transition, a camera, a punch-in and a
   split screen (plain, threads, music, mix without captions at 360, eased zoom) before any edit.
2. Extract `buildDraftPictureGraph(first, last)` (offsets from the first segment's start; drawn split at film frames
   minus the base's) plus sound/caption/output helpers; `buildFootageDraftArgs` = the graph over the whole cut. Golden
   must stay identical.
3. `planFootageDraftPieces`, `buildFootageDraftPieceArgs` (graph from the lead, `trim` to the piece's frames, CRF 16,
   no sound), `buildFootageDraftJoinArgs` (concat demuxer, `ass` once, sound, CRF 28, `-t` seconds).
4. `renderFootageDraft` `assembly` (default `pieces`) and `segmentsPerPiece`; pieces in `draft/pieces/`, removed after
   the join; progress 80/20; result `assembly`, `pieces`.
5. `estimateFootageDraftMemory`.
6. Tests: golden, plans (frames cover the cut for sizes 1-40, leads only at fade/drawn), piece and join args, estimate
   values, real ffmpeg frame comparison of both assemblies, measured memory (51/150 cuts pieces, 51 single) through a
   python wrapper reading `RUSAGE_CHILDREN`; the failure-hook test for both assemblies. README, CHANGELOG, 0.37.0.

## Progress

- [x] 1 `tests/fixtures/draft-assembly/single-args.json` written from the unchanged code.
- [x] 2 Refactor; golden byte-identical (`cmp` of regenerated output, then the test).
- [x] 3 Builders.
- [x] 4 Assembly option.
- [x] 5 Estimate.
- [x] 6 `npx vitest run tools/marketing-kit/tests/draft-assembly.test.ts tools/marketing-kit/src/footage/draft.test.ts`
  green (20 + 45 tests); frames within 6 grey levels everywhere; pieces 51/150 cuts ~193 MB each, one run of 51 more
  than twice that. `npx tsc --noEmit`, ESLint clean.

## Decisions (auto)

- Four segments per piece by default: one piece decodes at most five clips (with a lead), about 600 MB by the
  estimate at 1080x1920, well under a 1.5 GB worker, with fewer ffmpeg starts than one segment per piece.
- Pieces are encoded at CRF 16 and the join encodes once at the draft's CRF 28: a near-transparent intermediate
  instead of a lossless one keeps the pieces small on disk.
- The estimate counts a lead for every piece after the first (it does not read transitions): it errs high.
