# Implementation review: marketing-kit-overlay-entrances-exits

- Drift: none; every step of the plan is in the diff.
- Found while looking at frames and fixed: a staggered list's text sank on a rise exit while its card stayed
  (`isCardMoved`); a wiped keyword's underline outlived the wipe (it now ends as the wipe starts); a shadow lost its
  blur at the end of a blur entrance (`blurTags(own)`).
- Tests: 26 new, exact strings for tweens and tags, libass frames for the order criteria.
- Verdict: approve.
