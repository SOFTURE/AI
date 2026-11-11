# Plan review: marketing-kit-overlay-entrances-exits

- Backward compatibility (Warning, accepted): new resolved fields are optional and set only when a knob differs from
  its default; `auto` keeps the old exits. Covered by "keeps a look without the new knobs as it was".
- libass scales about the event's position (Warning, accepted): a pop moves the position with the scale, both linear,
  so the card's middle stays; checked on a frame.
- Overshoot (Critical, accepted): the soft pill's `back.out` is replaced; a test reads every ease and every tween.
- Verdict: approve.
