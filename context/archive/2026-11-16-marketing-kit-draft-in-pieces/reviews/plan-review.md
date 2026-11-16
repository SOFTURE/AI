# Plan review: marketing-kit-draft-in-pieces

- Contract between steps: the golden fixture comes before the refactor, so step 2 is verifiable. OK.
- Frame accuracy across borders: offsets relative to the lead's start; drawn split uses film frame differences, the
  piece trim uses the same integers (`planFootageDraftPieces.skipFrames`). Covered by the frame comparison. OK.
- Risk: the speech step also opens one input per segment. Measured with audio sources: 197 MB at 400 cuts. Recorded
  in research; not in scope (shared with the render, which has not failed). Accepted.
- Test portability (pre-push on macOS): the memory test uses python3 and `ru_maxrss` in bytes on macOS, KiB on Linux;
  skipped without python3. OK.
- Verdict: approve.
