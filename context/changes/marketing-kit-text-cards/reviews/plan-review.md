# Plan review: marketing-kit-text-cards

- Backward compatibility (Warning, accepted): every knob optional; `duration` minimum drops to 0.5 s only for
  `end_word` (the kind check keeps 1 s for the rest).
- Font licence (Warning, accepted): Caveat is OFL 1.1 without a reserved name; the subset and static instance ship
  with its licence and a README note on how they were made.
- Draft/render parity (Warning, accepted): positions come from one resolved shape; the drop's fall and the tilt's
  exact rasterisation differ by path, as typing already does; frames are compared within 2 % of the frame.
- Text fit (Warning, accepted): a note over 4 lines or an end word wider than the room even after shrinking is
  refused at resolve time, so an app's save-time check catches it.
- Verdict: approve.
