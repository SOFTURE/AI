# Plan review: marketing-kit-list-layouts

- Backward compatibility (Warning, accepted): a list without a side now centres. The new fields are optional
  (`isCentred`, `chips`), so a resolved list built by hand draws as before; the existing tests pin the side look with
  `side: "left"`.
- Overshoot (Critical, accepted): growth is a `power3.out` tween and monotone steps; a test checks no step is smaller
  than the one before.
- Reported boxes (Warning, accepted): `getDrawnOverlayCard` answers the chip row; a libass test compares the drawn row
  with the boxes within 2 %.
- Verdict: approve.
