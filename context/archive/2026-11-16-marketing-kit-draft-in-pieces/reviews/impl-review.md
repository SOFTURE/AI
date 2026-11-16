# Implementation review: marketing-kit-draft-in-pieces

- Drift from the plan: none.
- `single`: golden byte-identical; the existing draft tests unchanged except the failure-hook test, now run for both
  assemblies (the pieces step name is new).
- Pieces: leads only at fade and drawn transitions; the trim and `-frames:v` give each piece exactly its frames; the
  pieces cover the cut without a gap (tested for sizes 1 to 40).
- Cleanup: pieces removed after the join; a failed run leaves them (the next draft clears the draft folder first).
- Docs: README section and CHANGELOG 0.37.0; deploy's dev range widened.
- Verdict: approve.
