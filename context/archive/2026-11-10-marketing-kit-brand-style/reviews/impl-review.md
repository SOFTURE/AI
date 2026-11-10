# Implementation review: marketing-kit-brand-style

- Drift from plan: none. The side cards (keyword, lower third, list) went through RV-127's drawn card (0.25.0) and now
  take the brand style's corner, shadow and border like every other card (`getCardShapeEvents`).
- Correctness: `OverlayLook.cornerRadius` made optional so apps that build resolved overlays by hand keep compiling.
- Tests: tokens, measurer, wrap, box events, caption pill, every card kind with and without style, CSS, cover.
- Verdict: approve.
