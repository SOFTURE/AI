---
change_id: marketing-kit-smooth-cuts-1025
verdict: approved
---

# Plan review: marketing-kit-smooth-cuts-1025

- Covers the three gaps and the four "done when" points of #1025: ease frames on the built timeline and the draft
  filter, a 40 ms fade at every cut, the auto choice tested on synthetic pairs without a provider, defaults unchanged.
- Correctness: the crossfade keeps the speech in sync only if every interior side is lengthened by exactly D/2 and the
  edges are not; the plan pads a short source instead of shortening, and a real ffmpeg test checks the length. The
  draft's ease must start from the scale on screen before the cut, so a punch-out eases too.
- Compatibility: `cutFootage` keeps its sync signature; new options are optional; the EDL schema is untouched, so
  hand edits keep their transitions. Widening `FootageTransitions.jump` with `"auto"` only widens an input type.
- Note for implementation: a `kenburns` segment is not eased (its own tween owns the scale); say so in the README.
- Approved.
