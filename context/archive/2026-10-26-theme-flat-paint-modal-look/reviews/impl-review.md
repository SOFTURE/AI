---
change_id: theme-flat-paint-modal-look
verdict: approved
---

# Implementation review

- Plan coverage: keyframes and the three classes in `page.css`, `MODAL_LOOK`, `STANDING_PANEL_LOOK`,
  `getModalLook(width)`, README and CHANGELOG; tests pin the slot maps and the compiled keyframes (42/42).
- StandingPanel: it toggles `hidden`, and a CSS animation restarts when an element leaves `display: none`, so the
  panel slides in on every open, not only on mount.
- ui's `enter-leave` motion: with every transition off and no exit keyframes, `getLeaveTime` finds nothing running
  and the dialog closes at once, the design system's "no exit animation".
- Reduced motion: the existing rule cuts the new animations to 1 ms; `backwards` leaves the end state.
- Gates: typecheck, lint, language green; the theme's tests pass.
