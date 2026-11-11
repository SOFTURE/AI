# Implementation review: marketing-kit-list-layouts

- Drift: one addition: chips shrink like a title before `auto` falls back (found on the owner's own list, which did
  not fit at 48 px).
- Found while looking at frames and fixed: chip text sat left in its chip (`.ov-list .ov-card` is a column); a later
  long point overflowed the growing card in the draft (now clipped with an eased `\clip`).
- Tests: 23 new, exact markup, tweens and event times, libass frames for the chips and the growing stack.
- Verdict: approve.
